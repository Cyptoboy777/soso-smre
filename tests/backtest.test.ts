import test from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest, syntheticBook, assumptionsFor, WARMUP, type BtParams } from '../lib/backtest.ts';
import { simulateDca, simulateGrid, gridLevels, gridCellPct, planTwap } from '../lib/strategies.ts';
import { openPaper, stepPaper, paperStats, readPaper } from '../lib/paper.ts';

// Test fixtures only: generated price paths, never shown in the product.
function series(n: number, drift: number, amp: number, period = 24, start = 100) {
  const out = []; let p = start;
  for (let i = 0; i < n; i++) {
    const o = p; const c = start * (1 + drift * i) + amp * start * Math.sin((i / period) * 2 * Math.PI) ;
    const h = Math.max(o, c) * 1.004, l = Math.min(o, c) * 0.996; p = c;
    out.push({ t: 1_700_000_000_000 + i * 3_600_000, o, h, l, c, v: 100 });
  }
  return out;
}
const base = (candles: ReturnType<typeof series>, o: Partial<BtParams> = {}): BtParams => ({ pair: 'T_vUSDC', display: 'T/USDC', base: 'T', candles, takerFee: 0.00065, builderFeePct: 0.03, spreadPct: 0.1, equity: 10_000, riskPct: 1, minGrade: 'C', ...o });

test('synthetic book has the asked spread and is deep', () => {
  const b = syntheticBook(100, 0.2);
  assert.ok(Math.abs(((b.asks[0].price - b.bids[0].price) / 100) * 100 - 0.2) < 1e-9); assert.ok(b.asks[0].size * 100 > 1e9);
});

test('too few candles gives an empty, honest result', () => {
  const r = runBacktest(base(series(30, 0.001, 0.02)));
  assert.equal(r.trades.length, 0); assert.equal(r.enough, false); assert.equal(r.stats.net, 0);
});

test('equity ends at start plus the sum of trade P&L, and trades never overlap', () => {
  const r = runBacktest(base(series(900, 0.0004, 0.08, 50)));
  assert.ok(r.trades.length > 0, 'fixture should produce at least one trade');
  const sum = r.trades.reduce((s, t) => s + t.pnl, 0);
  assert.ok(Math.abs(r.stats.endEquity - (10_000 + sum)) < 1e-6);
  for (let i = 1; i < r.trades.length; i++) assert.ok(r.trades[i].entryIdx > r.trades[i - 1].exitIdx);
  assert.equal(r.stats.wins + r.stats.losses <= r.stats.trades, true);
  assert.ok(r.stats.maxDrawdownPct >= 0);
});

test('stop exits are never better than the stop; target exits never above the target spread', () => {
  const r = runBacktest(base(series(900, 0.0004, 0.08, 50)));
  for (const t of r.trades) {
    assert.ok(t.fees > 0);
    if (t.reason === 'stop') assert.ok(t.exit < t.entry);
    if (t.reason === 'target') assert.ok(t.exit > t.entry);
  }
});

test('no lookahead: changing future candles cannot change trades that already closed', () => {
  const full = series(900, 0.0004, 0.08, 50);
  const a = runBacktest(base(full.slice(0, 650)));
  const mutated = full.map((c, i) => (i >= 650 ? { ...c, o: c.o * 3, h: c.h * 3, l: c.l * 3, c: c.c * 3 } : c));
  const b = runBacktest(base(mutated));
  const closedBefore = a.trades.filter((t) => t.exitIdx < 649);
  assert.ok(closedBefore.length >= 3);
  closedBefore.forEach((t, i) => { assert.equal(b.trades[i].entryIdx, t.entryIdx); assert.equal(b.trades[i].exitIdx, t.exitIdx); assert.equal(b.trades[i].pnl, t.pnl); });
});

test('higher costs never improve the result and results are deterministic', () => {
  const c = series(900, 0.0004, 0.08, 50);
  const cheap = runBacktest(base(c, { spreadPct: 0.02, slipPct: 0 }));
  const dear = runBacktest(base(c, { spreadPct: 0.4, slipPct: 0.3 }));
  assert.ok(dear.stats.net <= cheap.stats.net + 1e-9);
  assert.deepEqual(runBacktest(base(c)).stats, runBacktest(base(c)).stats);
});

test('a stricter minimum grade never takes more trades', () => {
  const c = series(900, 0.0004, 0.08, 50);
  assert.ok(runBacktest(base(c, { minGrade: 'A' })).trades.length <= runBacktest(base(c, { minGrade: 'C' })).trades.length);
});

test('assumptions always say what is assumed', () => {
  const a = assumptionsFor({ spreadPct: 0.1, takerFee: 0.00065 }).join(' ');
  assert.match(a, /spread/); assert.match(a, /both the stop and the target/); assert.match(a, /do not predict/);
});

test('DCA: spends exactly the schedule and pays fees', () => {
  const c = series(100, 0.001, 0.02);
  const r = simulateDca({ candles: c, amountUsd: 50, everyBars: 10, takerFee: 0.001, spreadPct: 0.1 })!;
  assert.equal(r.trades, 10); assert.equal(r.invested, 500); assert.ok(r.feesPaid > 0);
  assert.equal(simulateDca({ candles: c, amountUsd: 0, everyBars: 10, takerFee: 0, spreadPct: 0 }), null);
});

test('DCA in a falling market loses and says so through net', () => {
  const r = simulateDca({ candles: series(100, -0.004, 0), amountUsd: 100, everyBars: 5, takerFee: 0.001, spreadPct: 0.1 })!;
  assert.ok(r.net < 0 && r.buyHoldPct < 0);
});

test('grid levels and cell width', () => {
  assert.deepEqual(gridLevels(100, 110, 3), [100, 105, 110]); assert.deepEqual(gridLevels(110, 100, 3), []);
  assert.ok(Math.abs(gridCellPct(100, 110, 3) - 5) < 1e-9);
});

test('grid earns in a range and reports completed cycles; fees count', () => {
  const c = series(400, 0, 0.04, 20);
  const r = simulateGrid({ candles: c, lower: 94, upper: 106, levels: 7, budgetUsd: 6000, makerFee: 0.0003 })!;
  assert.ok(r.trades > 0); assert.ok(r.feesPaid > 0); assert.ok(r.notes[0].includes('completed'));
  assert.ok(Math.abs(r.endValue - (6000 + r.net)) < 1e-6);
});

test('grid warns when the price leaves the range and when cells are thinner than fees', () => {
  const down = simulateGrid({ candles: series(200, -0.004, 0), lower: 70, upper: 100, levels: 4, budgetUsd: 3000, makerFee: 0.0003 })!;
  assert.ok(down.notes.some((n) => /below the grid/.test(n)));
  const thin = simulateGrid({ candles: series(100, 0, 0.01), lower: 99.9, upper: 100.1, levels: 20, budgetUsd: 1000, makerFee: 0.001 })!;
  assert.ok(thin.notes.some((n) => /too thin/.test(n)));
  assert.equal(simulateGrid({ candles: [], lower: 1, upper: 2, levels: 3, budgetUsd: 1, makerFee: 0 }), null);
});

test('TWAP planner checks slices against the market minimum', () => {
  const ok = planTwap(1000, 4, 8, 5); assert.equal(ok.ok, true); assert.equal(ok.sliceUsd, 125); assert.equal(ok.everyMin, 30);
  const small = planTwap(20, 2, 10, 5); assert.equal(small.ok, false); assert.match(small.problems[0], /minimum/);
  assert.equal(planTwap(0, 1, 1, 5).ok, false);
});

test('paper trade opens only from a valid setup and closes at stop, target or timeout', () => {
  const s = { pair: 'P', display: 'P/USDC', grade: 'B', entry: 100, stop: 95, tp1: 110, qty: 2 };
  assert.equal(openPaper({ ...s, stop: 101 }, 1, 0.1), null); assert.equal(openPaper({ ...s, qty: 0 }, 1, 0.1), null);
  const p = openPaper(s, 0, 0.1)!;
  assert.equal(stepPaper(p, 100, 1000), null);
  const w = stepPaper(p, 111, 1000)!; assert.equal(w.reason, 'target'); assert.ok(w.pnl > 0);
  const l = stepPaper(p, 94, 1000)!; assert.equal(l.reason, 'stop'); assert.ok(l.pnl < 0);
  assert.equal(stepPaper(p, 100, 49 * 3_600_000)!.reason, 'timeout');
  assert.equal(stepPaper(p, NaN, 0), null);
  const st = paperStats([w, l]); assert.equal(st.n, 2); assert.equal(st.winRate, 50);
  assert.equal(readPaper('nope').length, 0); assert.equal(readPaper([1, { a: 1 }]).length, 1);
});
