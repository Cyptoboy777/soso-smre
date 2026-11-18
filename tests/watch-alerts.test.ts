import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWatch, readSettings, readSeen, mentions, EMPTY_SEEN, DEFAULT_WATCH, type WatchCtx, type WatchItem } from '../lib/watch-alerts.ts';

const BTC: WatchItem = { name: 'vBTC_vUSDC', display: 'BTC/USDC', base: 'BTC', aliases: ['BTC', 'Bitcoin'], etfAsset: 'BTC' };
const SOL: WatchItem = { name: 'vSOL_vUSDC', display: 'SOL/USDC', base: 'SOL', aliases: ['SOL', 'Solana'], etfAsset: null };
const on = { ...DEFAULT_WATCH, enabled: true };
const now = 1_800_000_000_000;
const ctx = (o: Partial<WatchCtx> = {}): WatchCtx => ({ items: [BTC, SOL], tickers: {}, news: [], etf: {}, now, day: '2026-11-17', ...o });

test('whole-word matching', () => { assert.equal(mentions('Ethereum method', ['ETH']), false); assert.equal(mentions('ETH jumps', ['ETH']), true); assert.equal(mentions('btc-usd', ['BTC']), true); });

test('disabled settings raise nothing', () => {
  const r = evaluateWatch({ ...on, enabled: false }, ctx({ tickers: { vBTC_vUSDC: { changePct: 9, last: 1 } } }), EMPTY_SEEN);
  assert.equal(r.alerts.length, 0);
});

test('first run only baselines, so nothing floods', () => {
  const c = ctx({ tickers: { vBTC_vUSDC: { changePct: 9, last: 1 } }, news: [{ id: 'a', title: 'Bitcoin rallies', time: now }], etf: { BTC: { date: '2026-11-16', inflow: 1e8 } } });
  const r = evaluateWatch(on, c, EMPTY_SEEN);
  assert.equal(r.alerts.length, 0); assert.equal(r.seen.baselined, true);
  assert.equal(evaluateWatch(on, c, r.seen).alerts.length, 0); // still nothing: all already seen
});

test('price move alert fires once per pair, direction and day', () => {
  const base = evaluateWatch(on, ctx(), EMPTY_SEEN).seen;
  const c = ctx({ tickers: { vBTC_vUSDC: { changePct: -6.2, last: 1 }, vSOL_vUSDC: { changePct: 1, last: 1 } } });
  const a = evaluateWatch(on, c, base);
  assert.equal(a.alerts.length, 1); assert.equal(a.alerts[0].pair, 'vBTC_vUSDC'); assert.match(a.alerts[0].title, /down 6\.2%/);
  assert.equal(evaluateWatch(on, c, a.seen).alerts.length, 0);
  assert.equal(evaluateWatch(on, { ...c, day: '2026-11-18' }, a.seen).alerts.length, 1);
  assert.equal(evaluateWatch({ ...on, movePct: 10 }, c, base).alerts.length, 0);
});

test('news alert only for fresh headlines that mention a starred coin', () => {
  const base = evaluateWatch(on, ctx({ news: [{ id: 'old', title: 'Old', time: now }] }), EMPTY_SEEN).seen;
  const c = ctx({ news: [
    { id: 'n1', title: 'Solana network upgrade ships', time: now - 60_000 },
    { id: 'n2', title: 'Dogecoin moves', time: now },
    { id: 'n3', title: 'Bitcoin treasury news from last week', time: now - 7 * 3_600_000 },
  ] });
  const r = evaluateWatch(on, c, base);
  assert.equal(r.alerts.length, 1); assert.equal(r.alerts[0].pair, 'vSOL_vUSDC'); assert.equal(r.alerts[0].kind, 'news');
  assert.equal(evaluateWatch(on, c, r.seen).alerts.length, 0);
  assert.equal(evaluateWatch(on, { ...c, news: null }, base).alerts.length, 0); // missing feed: no alert, no crash
});

test('ETF alert once per date and only for starred coins with an ETF', () => {
  const base = evaluateWatch(on, ctx({ etf: { BTC: { date: '2026-11-14', inflow: 5 } } }), EMPTY_SEEN).seen;
  const c = ctx({ etf: { BTC: { date: '2026-11-15', inflow: -120_000_000 }, ETH: { date: '2026-11-15', inflow: 9 } } });
  const r = evaluateWatch(on, c, base);
  assert.equal(r.alerts.length, 1); assert.match(r.alerts[0].title, /BTC spot ETFs: -\$120M/);
  assert.equal(evaluateWatch(on, c, r.seen).alerts.length, 0);
  assert.equal(evaluateWatch(on, ctx({ items: [SOL], etf: c.etf }), base).alerts.length, 0);
});

test('stored settings and seen state are sanitised', () => {
  assert.deepEqual(readSettings(null), DEFAULT_WATCH);
  assert.equal(readSettings({ enabled: true, movePct: 999 }).movePct, 5);
  assert.equal(readSettings({ news: false }).news, false);
  assert.deepEqual(readSeen({ news: ['a', 3], baselined: true }).news, ['a']);
});
