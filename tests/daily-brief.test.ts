import test from 'node:test';
import assert from 'node:assert/strict';
import { pickMovers, pickHeadlines, buildBrief, briefIsEmpty, type BriefTicker } from '../lib/daily-brief.ts';

const T = (name: string, changePct: number, o: Partial<BriefTicker> = {}): BriefTicker => ({ name, display: name, base: name, halted: false, changePct, quoteVol: 50_000, last: 1, ...o });

test('movers: top gainers and losers, no thin, halted or broken markets', () => {
  const m = pickMovers([T('A', 12), T('B', 5), T('C', -9), T('D', -2), T('E', 80, { quoteVol: 10 }), T('F', 40, { halted: true }), T('G', NaN), T('H', 3, { last: 0 })])!;
  assert.deepEqual(m.gainers.map((x) => x.name), ['A', 'B']);
  assert.deepEqual(m.losers.map((x) => x.name), ['C', 'D']);
});

test('movers hidden when there is not enough data', () => { assert.equal(pickMovers([]), null); assert.equal(pickMovers([T('A', 3)]), null); assert.equal(pickMovers([T('A', 0), T('B', 0)]), null); });

test('headlines: newest first, de-duplicated, max 3', () => {
  const h = pickHeadlines([{ id: '1', title: 'BTC hits high!', url: 'u', time: 1 }, { id: '2', title: 'btc hits high', url: 'u', time: 5 }, { id: '3', title: 'ETF news', url: 'u', time: 4 }, { id: '4', title: 'Third', url: 'u', time: 3 }, { id: '5', title: 'Fourth', url: 'u', time: 2 }]);
  assert.deepEqual(h.map((x) => x.id), ['2', '3', '4']);
  assert.deepEqual(pickHeadlines(null), []);
});

test('brief leaves out missing parts and reports empty', () => {
  const b = buildBrief([], null, [null, undefined]);
  assert.equal(briefIsEmpty(b), true);
  const c = buildBrief([T('A', 2), T('B', -2)], [], [{ asset: 'BTC', date: '2026-11-16', inflow: 5 }, null]);
  assert.equal(briefIsEmpty(c), false); assert.equal(c.etf.length, 1); assert.equal(c.headlines.length, 0);
});
