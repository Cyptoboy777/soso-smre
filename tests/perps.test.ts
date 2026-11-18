import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTiers, tierFor, maintenanceMargin, liqPrice, sizeByRisk, stopTarget, fundingCost, liqGuard, safestLeverage,
  dailyLossHit, canOpenMore, computePerpSetup, orderPreview, floorTo, roundTo, maxLeverageFor, initialMargin, type PerpSetupIn,
} from '../lib/perps.ts';
import { openPaper, stepPaper } from '../lib/paper.ts';

// Tier shape copied from the live /perps/markets/symbols response (LINK-USD). Fixtures only, never shown in the product.
const TIERS = parseTiers([
  { maxNotionalValue: '1000000', maintenanceMarginRate: '0.05', maxLeverage: 10, maintenanceDeduction: '0' },
  { maxNotionalValue: '1000000000', maintenanceMarginRate: '0.1', maxLeverage: 5, maintenanceDeduction: '50000' },
]);

test('tiers parse, sort and pick by notional', () => {
  assert.equal(TIERS.length, 2);
  assert.equal(tierFor(TIERS, 500).mmr, 0.05);
  assert.equal(tierFor(TIERS, 2_000_000).mmr, 0.1);
  assert.equal(parseTiers('x').length, 0);
});

test('maintenance margin uses rate minus deduction and stays continuous at the tier edge', () => {
  assert.equal(maintenanceMargin(TIERS, 1000), 50);
  const below = maintenanceMargin(TIERS, 1_000_000), above = maintenanceMargin(TIERS, 1_000_001);
  assert.ok(Math.abs(above - below) < 1);
});

test('docs liquidation example: 25x long, 2% maintenance, liquidates about 2% lower', () => {
  const tiers = parseTiers([{ maxNotionalValue: '4000000', maintenanceMarginRate: '0.02', maxLeverage: 25, maintenanceDeduction: '0' }]);
  const liq = liqPrice({ side: 'long', entry: 100, size: 50, margin: 200, tiers });
  assert.ok(liq > 97.8 && liq < 98.1, String(liq));
  // at the liquidation price equity equals maintenance margin
  const equity = 200 - 50 * (100 - liq), mm = 0.02 * 50 * liq;
  assert.ok(Math.abs(equity - mm) < 1e-6);
});

test('short liquidation sits above entry and matches equity = maintenance', () => {
  const liq = liqPrice({ side: 'short', entry: 100, size: 10, margin: 200, tiers: TIERS });
  assert.ok(liq > 100);
  const equity = 200 - 10 * (liq - 100), mm = 0.05 * 10 * liq;
  assert.ok(Math.abs(equity - mm) < 1e-6);
});

test('risk sizing: a stop-out loses at most the risk %, fees included', () => {
  const r = sizeByRisk({ equity: 1000, riskPct: 1, entry: 100, stop: 98, feeRate: 0.0004, step: '0.1' });
  assert.ok(r.qty > 0);
  assert.ok(r.lossAtStop <= 10 + 1e-9, String(r.lossAtStop));
  assert.equal(r.qtyStr, floorTo(r.qty, '0.1'));
  assert.equal(sizeByRisk({ equity: 1000, riskPct: 1, entry: 100, stop: 100, feeRate: 0, step: '0.1' }).qty, 0);
});

test('ATR stop and 1:2 target for both sides', () => {
  const l = stopTarget({ side: 'long', entry: 100, atr: 2 });
  assert.equal(l.stop, 97); assert.equal(l.target, 106);
  const s = stopTarget({ side: 'short', entry: 100, atr: 2 });
  assert.equal(s.stop, 103); assert.equal(s.target, 94);
});

test('funding: positive rate costs longs and pays shorts', () => {
  assert.equal(fundingCost({ side: 'long', notional: 1000, rate: 0.0001, hours: 8, intervalHrs: 1 }), 0.8);
  assert.equal(fundingCost({ side: 'short', notional: 1000, rate: 0.0001, hours: 8, intervalHrs: 1 }), -0.8);
});

test('liquidation guard blocks when liq is closer than 2x the stop distance', () => {
  assert.equal(liqGuard({ side: 'long', entry: 100, stop: 97, liq: 95 }).ok, false);
  assert.equal(liqGuard({ side: 'long', entry: 100, stop: 97, liq: 93 }).ok, true);
  assert.equal(liqGuard({ side: 'short', entry: 100, stop: 103, liq: 105 }).ok, false);
  assert.equal(liqGuard({ side: 'long', entry: 100, stop: 101, liq: 50 }).ok, false);
});

test('safest leverage lowers until the guard passes', () => {
  // 10x on a 5% maintenance tier liquidates ~5% away; a 4% stop needs >= 8% room.
  const lev = safestLeverage({ side: 'long', entry: 100, stop: 96, size: 10, tiers: TIERS, want: 10 });
  assert.ok(lev != null && lev < 10, String(lev));
  const margin = initialMargin(1000, lev!);
  const liq = liqPrice({ side: 'long', entry: 100, size: 10, margin, tiers: TIERS });
  assert.ok(liqGuard({ side: 'long', entry: 100, stop: 96, liq }).ok);
  // one step higher would fail
  const liqUp = liqPrice({ side: 'long', entry: 100, size: 10, margin: initialMargin(1000, lev! + 1), tiers: TIERS });
  assert.equal(liqGuard({ side: 'long', entry: 100, stop: 96, liq: liqUp }).ok, false);
  // 1x short liquidates ~90% up: a 40% stop fits, a 50% stop cannot fit at any leverage
  assert.equal(safestLeverage({ side: 'short', entry: 100, stop: 140, size: 1, tiers: TIERS, want: 3 }), 1);
  assert.equal(safestLeverage({ side: 'short', entry: 100, stop: 150, size: 1, tiers: TIERS, want: 3 }), null);
});

test('daily loss cap and max open positions', () => {
  assert.equal(dailyLossHit(-30, 1000, 3), true);
  assert.equal(dailyLossHit(-29, 1000, 3), false);
  assert.equal(dailyLossHit(50, 1000, 3), false);
  assert.equal(canOpenMore(2, 3), true);
  assert.equal(canOpenMore(3, 3), false);
});

test('rounding helpers never emit scientific notation', () => {
  assert.equal(floorTo(0.000123456, '0.00001'), '0.00012');
  assert.equal(roundTo(64531.6, '1'), '64532');
  assert.equal(floorTo(-1, '0.1'), '0');
});

test('leverage cap respects our hard cap, the symbol and the tier', () => {
  assert.equal(maxLeverageFor(40, TIERS, 100), 10);
  assert.equal(maxLeverageFor(5, TIERS, 100), 5);
  assert.equal(maxLeverageFor(10, TIERS, 2_000_000), 5);
});

function trendCandles(n: number, drift: number, start = 100) {
  const out = []; let p = start;
  for (let i = 0; i < n; i++) { const o = p; const c = p * (1 + drift) + Math.sin(i) * 0.2; out.push({ t: i * 3_600_000, o, h: Math.max(o, c) * 1.003, l: Math.min(o, c) * 0.997, c, v: 10 }); p = c; }
  return out;
}
const baseIn = (o: Partial<PerpSetupIn> = {}): PerpSetupIn => {
  const c = trendCandles(120, 0.002);
  const last = c[c.length - 1].c;
  return { c1h: c, c4h: trendCandles(120, 0.004), mark: last, bid: last * 0.9999, ask: last * 1.0001, funding: 0.00001, fundingHrs: 1, takerFee: 0.0004, tiers: TIERS, symbolMaxLev: 10, step: '0.01', tick: '0.01', minQty: 0.01, minNotional: 10, equity: 1000, available: 1000, riskPct: 1, leverage: 2, openPositions: 0, ...o };
};

test('aligned uptrend gives a long Good to go setup that risks at most 1%', () => {
  const r = computePerpSetup(baseIn());
  assert.equal(r.side, 'long'); assert.equal(r.verdict, 'go'); assert.equal(r.blocked, false);
  assert.ok(r.stop < r.entry && r.target > r.entry);
  assert.ok(Math.abs((r.target - r.entry) - 2 * (r.entry - r.stop)) < 0.05);
  assert.ok(r.lossAtStop <= 10 + 1e-6, String(r.lossAtStop));
  assert.ok(r.leverage <= 2);
  assert.ok(Math.abs(r.entry - r.liq) >= 2 * Math.abs(r.entry - r.stop));
});

test('forced side against the trend is risky', () => {
  const r = computePerpSetup(baseIn({ side: 'short' }));
  assert.equal(r.side, 'short'); assert.equal(r.verdict, 'risky');
  assert.ok(r.reasons.some((x) => /against/.test(x)));
});

test('mixed trends say Wait; high funding against the side says Wait', () => {
  const mixed = computePerpSetup(baseIn({ c4h: trendCandles(120, -0.004) }));
  assert.equal(mixed.verdict, 'wait'); assert.equal(mixed.side, null);
  const fund = computePerpSetup(baseIn({ funding: 0.001 }));
  assert.equal(fund.verdict, 'wait');
});

test('daily cap and max positions block new setups', () => {
  assert.equal(computePerpSetup(baseIn({ realizedToday: -40, dailyCapPct: 3 })).blocked, true);
  const r = computePerpSetup(baseIn({ openPositions: 3, maxOpen: 3 }));
  assert.equal(r.blocked, true); assert.equal(r.verdict, 'risky');
});

test('tiny balance below min notional waits instead of trading', () => {
  const r = computePerpSetup(baseIn({ equity: 20, available: 20, minNotional: 100 }));
  assert.equal(r.verdict, 'wait'); assert.equal(r.blocked, true);
});

test('order preview shows margin, fees and liquidation', () => {
  const p = orderPreview({ side: 'long', price: 100, qty: 2, leverage: 2, feeRate: 0.0004, tiers: TIERS, stop: 95 });
  assert.equal(p.notional, 200); assert.equal(p.margin, 100); assert.ok(Math.abs(p.fees - 0.08) < 1e-12);
  assert.ok(p.liq < 100 && p.guard?.ok === true);
});

test('paper engine handles shorts and keeps longs unchanged', () => {
  const s = openPaper({ pair: 'BTC-USD', display: 'BTC', grade: 'go', entry: 100, stop: 103, tp1: 94, qty: 1, side: 'short' }, 0, 0);
  assert.ok(s);
  const win = stepPaper(s!, 93, 1000);
  assert.equal(win?.reason, 'target'); assert.ok((win?.pnl ?? 0) > 0);
  assert.equal(stepPaper(s!, 104, 1000)?.reason, 'stop');
  assert.equal(openPaper({ pair: 'X', display: 'X', grade: 'go', entry: 100, stop: 97, tp1: 106, qty: 1, side: 'short' }, 0, 0), null);
  const l = openPaper({ pair: 'X', display: 'X', grade: 'A', entry: 100, stop: 97, tp1: 106, qty: 1 }, 0, 0);
  assert.equal(l?.side, undefined);
});
