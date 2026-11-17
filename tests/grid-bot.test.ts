import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_CLORD_PREFIX,
  GRID_MAX_LEVELS,
  GRID_MIN_LEVELS,
  buildGridLevels,
  combineGridVerdict,
  feeFraction,
  feePctText,
  feeToUsd,
  gridClOrdId,
  gridStyleVerdict,
  inventoryFromFills,
  isGridClOrdId,
  markToMarketPnl,
  oppositeIndex,
  previewGrid,
  shouldStopGrid,
  validateGridInput,
  wouldTakeLiquidity,
  type GridConfig,
  type GridPreview,
} from '../lib/grid-bot.ts';
import type { GuardResult } from '../lib/trade-guard.ts';

const cfg = (over: Partial<GridConfig> = {}): GridConfig => ({
  lower: 90,
  upper: 110,
  levels: 5,
  budget: 500,
  dailyLossCap: 40,
  makerFee: 0.0002,
  builderFee: 0.0001,
  tick: '0.01',
  step: '0.0001',
  minNotional: 5,
  minQty: 0,
  ...over,
});

test('builds evenly spaced levels, buys below last, sells above, skips the mid', () => {
  const r = buildGridLevels(cfg({ levels: 5 }), 100);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.levels.length, 5);
  assert.deepEqual(r.levels.map((l) => l.price), [90, 95, 100, 105, 110]);
  assert.deepEqual(r.levels.map((l) => l.startSide), ['buy', 'buy', 'skip', 'sell', 'sell']);
  assert.equal(r.minSpacing, 5);
  assert.equal(r.spacing, 5);
});

test('rounds prices to the tick and drops duplicates', () => {
  const r = buildGridLevels(cfg({ lower: 100, upper: 100.04, levels: 8, tick: '0.01', budget: 80 }), 100.02);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const prices = r.levels.map((l) => l.priceStr);
  assert.equal(new Set(prices).size, prices.length);
  assert.ok(r.levels.length >= 2 && r.levels.length < 8);
  assert.equal(r.uniqueRequested, true);
});

test('rejects a range tighter than one tick', () => {
  const r = buildGridLevels(cfg({ lower: 100, upper: 100.004, tick: '0.01' }), 100);
  assert.equal(r.ok, false);
});

test('rejects too few or too many levels', () => {
  assert.ok(validateGridInput(cfg({ levels: 1 })).some((m) => m.includes('between')));
  assert.ok(validateGridInput(cfg({ levels: GRID_MAX_LEVELS + 1 })).some((m) => m.includes('between')));
  assert.equal(GRID_MIN_LEVELS, 2);
});

test('preview computes net profit and round-trip fee from real maker + builder fees', () => {
  const r = previewGrid(cfg({ levels: 5, budget: 500, makerFee: 0.0002, builderFee: 0.0001 }), 100);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const p = r.preview;
  assert.equal(p.levelCount, 5);
  assert.equal(p.buyLevels, 2);
  assert.equal(p.sellLevels, 2);
  assert.equal(p.skippedLevels, 1);
  // Tightest step is 5 on 90: gross 5/90 ≈ 5.555...%
  assert.ok(Math.abs(p.grossProfitPct - (5 / 90) * 100) < 1e-9);
  assert.ok(p.netProfitPct != null && p.roundTripFee != null);
  const qty = Math.min(p.levels[0].qty, p.levels[1].qty);
  const buyN = 90 * qty;
  const sellN = 95 * qty;
  const fee = 0.0003 * buyN + 0.0003 * sellN;
  assert.ok(Math.abs((p.roundTripFee as number) - fee) < 1e-9);
  const netPct = ((5 * qty - fee) / buyN) * 100;
  assert.ok(Math.abs((p.netProfitPct as number) - netPct) < 1e-9);
  assert.ok((p.netProfitPct as number) > 0);
});

test('unpublished maker fee leaves profit and fee fields empty rather than inventing a number', () => {
  const r = previewGrid(cfg({ makerFee: Number.NaN, builderFee: 0.0001 }), 100);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.preview.netProfitPct, null);
  assert.equal(r.preview.roundTripFee, null);
  assert.equal(r.preview.breakEvenRoundTrips, null);
  assert.equal(feePctText(Number.NaN), null);
  assert.equal(feePctText(undefined), null);
  assert.equal(feeFraction(undefined, 0.0001), null);
  assert.equal(feePctText(0), '0.000%');
  assert.equal(feeFraction(0, 0.0001), 0.0001);
});

test('worst-case loss is the mark-to-market of start buys if price drops to the lower bound', () => {
  const r = previewGrid(cfg({ levels: 5, budget: 500, lower: 90, upper: 110 }), 100);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const buys = r.preview.levels.filter((l) => l.startSide === 'buy');
  const cost = buys.reduce((s, l) => s + l.quote, 0);
  const qty = buys.reduce((s, l) => s + l.qty, 0);
  const expect = cost - qty * 90;
  assert.ok(Math.abs(r.preview.worstCaseLoss - expect) < 1e-8);
  assert.ok(r.preview.worstCaseLoss > 0);
  assert.ok(r.preview.worstCaseAvgBuy > 90);
  assert.ok(r.preview.breakEvenRoundTrips != null && r.preview.breakEvenRoundTrips >= 1);
});

test('fees that eat the whole step are flagged and net profit is not positive', () => {
  const r = previewGrid(cfg({ lower: 100, upper: 100.02, levels: 2, tick: '0.01', makerFee: 0.002, builderFee: 0, budget: 200 }), 100.01);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.preview.netProfitPct != null && r.preview.netProfitPct <= 0);
  assert.ok(r.preview.issues.some((i) => /eat the whole step/i.test(i)));
  const v = gridStyleVerdict(r.preview, 100.01, 100, 100.02, false);
  assert.equal(v.verdict, 'risky');
});

test('stops when price leaves the range, but not at the exact bound', () => {
  const base = { realizedPnl: 0, markToMarket: 0, dailyLossCap: 10, lower: 90, upper: 110 };
  assert.deepEqual(shouldStopGrid({ ...base, lastPrice: 90 }), { stop: false, reason: null });
  assert.deepEqual(shouldStopGrid({ ...base, lastPrice: 110 }), { stop: false, reason: null });
  assert.deepEqual(shouldStopGrid({ ...base, lastPrice: 89.99 }), { stop: true, reason: 'out-of-range' });
  assert.deepEqual(shouldStopGrid({ ...base, lastPrice: 110.01 }), { stop: true, reason: 'out-of-range' });
});

test('stops on daily loss cap using realized plus mark-to-market, or on user stop', () => {
  const base = { lastPrice: 100, lower: 90, upper: 110, dailyLossCap: 10 };
  assert.equal(shouldStopGrid({ ...base, realizedPnl: -4, markToMarket: -5 }).stop, false);
  assert.deepEqual(shouldStopGrid({ ...base, realizedPnl: -4, markToMarket: -6 }), { stop: true, reason: 'daily-loss' });
  assert.deepEqual(shouldStopGrid({ ...base, realizedPnl: -10, markToMarket: 0 }), { stop: true, reason: 'daily-loss' });
  assert.equal(shouldStopGrid({ ...base, realizedPnl: -50, markToMarket: 0, dailyLossCap: 0 }).stop, false);
  assert.deepEqual(shouldStopGrid({ ...base, realizedPnl: 0, markToMarket: 0, userStop: true }), { stop: true, reason: 'user-stop' });
});

test('a filled buy places a sell one level up, and a filled sell places a buy one level down', () => {
  assert.equal(oppositeIndex(1, 'buy', 5), 2);
  assert.equal(oppositeIndex(3, 'sell', 5), 2);
  assert.equal(oppositeIndex(4, 'buy', 5), null);
  assert.equal(oppositeIndex(0, 'sell', 5), null);
  assert.equal(oppositeIndex(-1, 'buy', 5), null);
  assert.equal(oppositeIndex(5, 'sell', 5), null);
});

test('FIFO inventory counts realized profit after fees and leftover mark-to-market', () => {
  const inv = inventoryFromFills([
    { side: 'buy', price: 100, qty: 2, feeUsd: 0.04 },
    { side: 'sell', price: 110, qty: 1, feeUsd: 0.022 },
  ]);
  // lot cost 200.04, sell 1 unit cost 100.02, proceeds 110, fee 0.022 → realized 9.958
  assert.ok(Math.abs(inv.realizedPnl - 9.958) < 1e-9);
  assert.equal(inv.base, 1);
  assert.ok(Math.abs(inv.costUsd - 100.02) < 1e-9);
  assert.ok(Math.abs(markToMarketPnl(inv.base, inv.costUsd, 100) - (100 - 100.02)) < 1e-9);
  assert.equal(markToMarketPnl(0, 0, 100), 0);
});

test('fee to USDC is converted only when the fee coin is known', () => {
  assert.equal(feeToUsd(0.05, 'vUSDC', 100, ['vUSDC', 'USDC'], ['vBTC', 'BTC']), 0.05);
  assert.equal(feeToUsd(0.001, 'vBTC', 100, ['vUSDC'], ['vBTC']), 0.1);
  assert.equal(feeToUsd(0.05, 'mystery', 100, ['vUSDC'], ['vBTC']), null);
  assert.equal(feeToUsd(0.05, '', 100, ['vUSDC'], ['vBTC']), null);
});

test('post-only crossing is detected from the live best bid and ask', () => {
  assert.equal(wouldTakeLiquidity('buy', 100, 99, 100), true);
  assert.equal(wouldTakeLiquidity('buy', 99.9, 99, 100), false);
  assert.equal(wouldTakeLiquidity('sell', 99, 99, 100), true);
  assert.equal(wouldTakeLiquidity('sell', 99.1, 99, 100), false);
  assert.equal(wouldTakeLiquidity('buy', 100, 99, undefined), false);
});

test('grid verdict is good in a mid-range setup, wait near the edge, risky when halted', () => {
  const mid = previewGrid(cfg(), 100);
  assert.equal(mid.ok, true);
  if (!mid.ok) return;
  const good = gridStyleVerdict(mid.preview, 100, 90, 110, false);
  assert.equal(good.verdict, 'good');
  const edge = gridStyleVerdict(mid.preview, 91, 90, 110, false);
  assert.equal(edge.verdict, 'wait');
  const halt = gridStyleVerdict(mid.preview, 100, 90, 110, true);
  assert.equal(halt.verdict, 'risky');
});

test('combining with Trade Guard keeps the stricter verdict and appends its reasons', () => {
  const grid = { verdict: 'good' as const, reasons: ['Grid looks fine.'] };
  const guard: GuardResult = { verdict: 'wait', reasons: ['Spread is wide.'] };
  const c = combineGridVerdict(grid, guard);
  assert.equal(c.verdict, 'wait');
  assert.ok(c.reasons.includes('Grid looks fine.'));
  assert.ok(c.reasons.includes('Spread is wide.'));
  const risky = combineGridVerdict({ verdict: 'risky', reasons: ['Halted.'] }, { verdict: 'wait', reasons: ['Spread is wide.'] });
  assert.equal(risky.verdict, 'risky');
});

test('grid client-order ids use a stable prefix and never look like a key', () => {
  const id = gridClOrdId();
  assert.equal(isGridClOrdId(id), true);
  assert.ok(id.startsWith(GRID_CLORD_PREFIX));
  assert.equal(isGridClOrdId('lm-abc'), false);
  assert.equal(isGridClOrdId(''), false);
});
