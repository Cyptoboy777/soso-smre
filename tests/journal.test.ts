import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeFills, buildTrades, weeklyInsight, isShareable, shareText, recordSnapshot, portfolioChange, normSide, type JFill } from '../lib/journal.ts';

let n = 0;
const f = (o: Partial<JFill> & { side: 'buy' | 'sell'; price: number; qty: number; time: number }): JFill => ({ id: `t${++n}`, symbol: 'vBTC_vUSDC', base: 'BTC', quote: 'vUSDC', fee: 0, feeCoin: 'vUSDC', orderID: n, ...o });
const H = 3_600_000;

test('normSide reads SoDEX side values', () => { assert.equal(normSide('SELL'), 'sell'); assert.equal(normSide('2'), 'sell'); assert.equal(normSide('BUY'), 'buy'); assert.equal(normSide(1), 'buy'); });

test('mergeFills dedupes, sorts and bounds', () => {
  const a = f({ side: 'buy', price: 10, qty: 1, time: 2 }); const b = f({ side: 'buy', price: 10, qty: 1, time: 1 });
  const m = mergeFills([a], [a, b]);
  assert.equal(m.length, 2); assert.equal(m[0].time, 1);
  assert.equal(mergeFills([], [a, b], 1).length, 1);
  assert.equal(mergeFills([], [f({ side: 'buy', price: 0, qty: 1, time: 1 }), f({ side: 'buy', price: 1, qty: 0, time: 1 })]).length, 0);
});

test('realised PnL uses average cost and counts fees', () => {
  const t = buildTrades([
    f({ side: 'buy', price: 100, qty: 1, time: 1, fee: 0.1 }),
    f({ side: 'buy', price: 120, qty: 1, time: 2, fee: 0.1 }),
    f({ side: 'sell', price: 130, qty: 1, time: 3, fee: 0.13 }),
  ]);
  assert.equal(t.length, 1);
  assert.ok(Math.abs((t[0].entry as number) - 110.1) < 1e-9);          // (100.1 + 120.1) / 2
  assert.ok(Math.abs((t[0].pnl as number) - (129.87 - 110.1)) < 1e-9);
  assert.equal(t[0].exit, 130);
  assert.ok(t[0].fees > 0.13);
});

test('a sell with no known cost is listed but has no PnL', () => {
  const t = buildTrades([f({ side: 'sell', price: 50, qty: 2, time: 1 })]);
  assert.equal(t[0].pnl, null); assert.equal(t[0].entry, null); assert.equal(isShareable(t[0]), false);
});

test('partly known sell only counts the known part', () => {
  const t = buildTrades([f({ side: 'buy', price: 10, qty: 1, time: 1 }), f({ side: 'sell', price: 20, qty: 2, time: 2 })]);
  assert.equal(t[0].qty, 1); assert.equal(t[0].pnl, 10);
});

test('fills of one order become one trade; base-coin fees shrink the position', () => {
  const o = 77;
  const t = buildTrades([
    f({ side: 'buy', price: 100, qty: 1, time: 1, fee: 0.001, feeCoin: 'BTC' }),
    f({ side: 'sell', price: 110, qty: 0.4, time: 2, orderID: o }), f({ side: 'sell', price: 112, qty: 0.4, time: 3, orderID: o }),
  ]);
  assert.equal(t.length, 1); assert.ok(Math.abs(t[0].exit - 111) < 1e-9); assert.ok((t[0].pnl as number) > 0);
});

test('pnl percent and shareable only when profitable', () => {
  const win = buildTrades([f({ side: 'buy', price: 100, qty: 1, time: 1 }), f({ side: 'sell', price: 110, qty: 1, time: 2 })])[0];
  const loss = buildTrades([f({ side: 'buy', price: 100, qty: 1, time: 1 }), f({ side: 'sell', price: 90, qty: 1, time: 2 })])[0];
  assert.ok(Math.abs((win.pnlPct as number) - 10) < 1e-9); assert.equal(isShareable(win), true); assert.equal(isShareable(loss), false);
  assert.equal(shareText('BTC/USDC', 10), 'BTC/USDC closed +10.00% on SoDEX with SoSwapDEX. soswapdex.xyz');
});

test('weekly insight needs 3 trades and names the worst coin and time of day', () => {
  const now = Date.UTC(2026, 10, 17, 12);
  const mk = (base: string, pnl: number, hoursAgo: number, hourUtc?: number) => ({ id: `${base}${hoursAgo}`, symbol: base, base, closedAt: hourUtc == null ? now - hoursAgo * H : Date.UTC(2026, 10, 16, hourUtc), entry: 1, exit: 1, qty: 1, pnl, pnlPct: pnl, fees: 0 });
  assert.equal(weeklyInsight([mk('ETH', -1, 1), mk('ETH', -1, 2)], now), null);
  const i = weeklyInsight([mk('SOL', -5, 0, 2), mk('SOL', -4, 0, 3), mk('SOL', -2, 0, 4), mk('BTC', 3, 5)], now)!;
  assert.equal(i.count, 4); assert.equal(i.losses, 3); assert.equal(i.worstCoin?.base, 'SOL');
  assert.match(i.worstPeriod!.label, /night/); assert.ok(i.lines.length >= 2);
  const old = weeklyInsight([mk('SOL', -1, 24 * 9), mk('SOL', -1, 24 * 9), mk('SOL', -1, 24 * 9)], now);
  assert.equal(old, null);
  assert.equal(weeklyInsight([mk('A', 1, 1), mk('B', 1, 2), mk('C', 1, 3)], now)!.lines[0], 'No losing trades this week.');
});

test('timezone offset moves the time-of-day bucket', () => {
  const now = Date.UTC(2026, 10, 17, 12);
  const mk = (h: number) => ({ id: String(h), symbol: 'X', base: 'X', closedAt: Date.UTC(2026, 10, 16, h), entry: 1, exit: 1, qty: 1, pnl: -1, pnlPct: -1, fees: 0 });
  const i = weeklyInsight([mk(19), mk(20), mk(21)], now, 330)!; // +5:30 → 00:30 to 02:30
  assert.match(i.worstPeriod!.label, /night/);
});

test('portfolio snapshots: hourly points, change vs ~24h ago, hidden when too fresh', () => {
  const t0 = Date.UTC(2026, 10, 16, 0);
  let s = recordSnapshot([], t0, 100);
  s = recordSnapshot(s, t0 + 10 * 60_000, 101); assert.equal(s.length, 1);
  s = recordSnapshot(s, t0 + 2 * H, 105); assert.equal(s.length, 2);
  assert.equal(portfolioChange(s, t0 + 3 * H, 110), null);
  const c = portfolioChange(s, t0 + 25 * H, 121)!; assert.ok(Math.abs(c.change - 20) < 1e-9); assert.equal(c.hours, 25);
  assert.equal(portfolioChange([], t0, 5), null);
  assert.equal(recordSnapshot(s, t0 + 30 * 24 * H, 50).length, 1);
});
