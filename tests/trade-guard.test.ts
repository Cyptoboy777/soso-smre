import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGuard,
  computeSafeSize,
  formatAmount,
  tradeCost,
  portfolioShare,
  newsMood,
  etfMood,
  pickMoveNews,
  matchingHeadlines,
  headlineTone,
  suggestExit,
  volatilityUnit,
  parseAskIntent,
  fallbackAskReply,
  formatUsd,
  MOVE_NEWS_PCT,
  REWARD_TO_RISK,
  PORTFOLIO_RISKY_PCT,
  type GuardInput,
  type NewsHeadline,
} from '../lib/trade-guard.ts';
import type { Candle } from '../lib/setup.ts';

const NOW = Date.parse('2026-11-17T15:00:00Z');
const H = (title: string, hoursAgo: number, extra: Partial<NewsHeadline> = {}): NewsHeadline => ({
  title, time: NOW - hoursAgo * 3600_000, ...extra,
});

const baseIn = (over: Partial<GuardInput> = {}): GuardInput => ({
  amount: 100,
  available: 500,
  isFromQuote: true,
  quoteDecimals: 6,
  notionalUsd: 100,
  feeUsd: 0.1,
  impactPct: 0.05,
  spreadPct: 0.04,
  coveragePct: 100,
  rangePct: 2,
  volShare: 0.01,
  halted: false,
  bookReady: true,
  portfolioUsd: 2000,
  newsLoaded: true,
  news: [],
  etfLoaded: true,
  etf: null,
  now: NOW,
  base: 'SOL',
  side: 'buy',
  ...over,
});

test('good verdict when book, size and cost are clean', () => {
  const g = computeGuard(baseIn());
  assert.equal(g.verdict, 'good');
  assert.ok(g.reasons.length >= 1 && g.reasons.length <= 3);
  assert.ok(g.costUsd != null && g.costUsd > 0);
  assert.equal(g.depthText, 'Visible depth covers this size.');
  assert.match(g.portfolioText ?? '', /5\.0% of your spot portfolio/);
});

test('total cost is fees + half-spread + slippage from the book, nothing invented', () => {
  const c = tradeCost({ notionalUsd: 1000, feeUsd: 2, builderFeeUsd: 0.1, impactPct: 0.5, spreadPct: 0.4, bookReady: true });
  assert.ok(c);
  // fees 2.1, half-spread 0.2% of 1000 = 2, slippage 0.5% of 1000 = 5
  assert.equal(c.parts.fees, 2.1);
  assert.equal(c.parts.spread, 2);
  assert.equal(c.parts.slippage, 5);
  assert.equal(c.costUsd, 9.1);
});

test('cost is hidden when the book is not ready', () => {
  assert.equal(tradeCost({ notionalUsd: 100, feeUsd: 1, impactPct: 0, spreadPct: 0, bookReady: false }), null);
  const g = computeGuard(baseIn({ bookReady: false }));
  assert.equal(g.costUsd, undefined);
  assert.equal(g.depthText, undefined);
});

test('risky when depth cannot cover the size', () => {
  const g = computeGuard(baseIn({ coveragePct: 62, impactPct: 0.1 }));
  assert.equal(g.verdict, 'risky');
  assert.match(g.reasons[0], /covers only 62%/);
});

test('risky when impact is above 2%', () => {
  const g = computeGuard(baseIn({ impactPct: 2.4, coveragePct: 100 }));
  assert.equal(g.verdict, 'risky');
  assert.ok(g.reasons.some((r) => /2\.40%/.test(r)));
});

test('wait when impact is moderate or spread is wide', () => {
  const g = computeGuard(baseIn({ impactPct: 0.8, spreadPct: 0.1 }));
  assert.equal(g.verdict, 'wait');
});

test('risky when the size is too much of the spot portfolio', () => {
  const g = computeGuard(baseIn({ notionalUsd: 900, portfolioUsd: 2000 }));
  assert.equal(g.verdict, 'risky');
  assert.ok((900 / 2000) * 100 > PORTFOLIO_RISKY_PCT);
  assert.ok(g.reasons.some((r) => /45% of your spot portfolio/.test(r)));
});

test('portfolio share is hidden when the portfolio is unknown', () => {
  assert.equal(portfolioShare(100, null), null);
  assert.equal(portfolioShare(100, 0), null);
  const g = computeGuard(baseIn({ portfolioUsd: null }));
  assert.equal(g.portfolioText, undefined);
  assert.equal(g.verdict, 'good');
});

test('mood line is hidden when news and ETF were not loaded', () => {
  const g = computeGuard(baseIn({ newsLoaded: false, etfLoaded: false, news: null, etf: null }));
  assert.equal(g.mood, undefined);
});

test('mood uses only last-24h headlines that mention the coin', () => {
  const news = [
    H('Solana validators approve upgrade', 2),
    H('Bitcoin hits a record high', 1),
    H('Solana outage last month', 30),
  ];
  const m = newsMood('SOL', news, NOW);
  assert.ok(m);
  assert.equal(m.count, 1);
  assert.equal(m.tone, 'up');
  assert.match(m.text, /1 SOL headline/);
  assert.deepEqual(matchingHeadlines(news, 'SOL', NOW).map((x) => x.title), ['Solana validators approve upgrade']);
});

test('ETF mood is hidden without a real snapshot and formats inflow honestly', () => {
  assert.equal(etfMood(null), null);
  assert.equal(etfMood({ asset: 'BTC', date: '', inflow: 10 }), null);
  const e = etfMood({ asset: 'BTC', date: '2026-11-16', inflow: -120_000_000 });
  assert.ok(e && e.outflow && e.large);
  assert.match(e.text, /US spot BTC ETFs: −\$120\.0M net on 2026-11-16/);
});

test('buying into a large ETF outflow is Wait, not a forged grade upgrade', () => {
  const g = computeGuard(baseIn({
    etf: { asset: 'BTC', date: '2026-11-16', inflow: -80_000_000 },
    etfLoaded: true,
    base: 'BTC',
    side: 'buy',
  }));
  assert.equal(g.verdict, 'wait');
  assert.ok(g.reasons.some((r) => /outflow/.test(r)));
});

test('safe size floors to the lot step, stays within spendable spot, and is not Risky', () => {
  const evaluate = (amount: number): GuardInput => {
    // $1 per unit; impact and coverage blow up above 40 units. Available 80.
    const notionalUsd = amount;
    const coveragePct = amount <= 40 ? 100 : 50;
    const impactPct = amount <= 40 ? 0.1 : 3;
    return baseIn({ amount, available: 80, isFromQuote: false, fromStep: '0.01', notionalUsd, coveragePct, impactPct, portfolioUsd: 10_000 });
  };
  const current = evaluate(75.129);
  assert.equal(computeGuard(current).verdict, 'risky');
  const safe = computeSafeSize(current, evaluate);
  assert.ok(safe);
  assert.equal(safe, formatAmount(Number(safe), { isFromQuote: false, fromStep: '0.01' }));
  assert.ok(Number(safe) <= 40 + 1e-9);
  assert.ok(Number(safe) <= 80);
  assert.equal(Number(safe), Number(formatAmount(Number(safe), { isFromQuote: false, fromStep: '0.01' })));
  assert.notEqual(computeGuard(evaluate(Number(safe))).verdict, 'risky');
});

test('safe size is null when the market is halted or even a tiny size is Risky', () => {
  const halted = baseIn({ halted: true, coveragePct: 10 });
  assert.equal(computeSafeSize(halted, (a) => baseIn({ ...halted, amount: a })), null);
  const empty = (amount: number) => baseIn({ amount, coveragePct: 0, bookReady: true, spreadPct: 0, notionalUsd: amount });
  assert.equal(computeSafeSize(empty(10), empty), null);
});

test('quote-coin safe size floors to quote decimals and never exceeds available', () => {
  const evaluate = (amount: number): GuardInput => baseIn({
    amount, available: 25.5, isFromQuote: true, quoteDecimals: 6,
    notionalUsd: amount, coveragePct: amount <= 20 ? 100 : 40, impactPct: 0.1, portfolioUsd: 10_000,
  });
  const safe = computeSafeSize(evaluate(25.5), evaluate);
  assert.ok(safe);
  assert.ok(Number(safe) <= 20 + 1e-9);
  assert.ok(Number(safe) <= 25.5);
  assert.equal(safe, formatAmount(Number(safe), { isFromQuote: true, quoteDecimals: 6 }));
});

test('move news is hidden below the 3% threshold or when no headline matches', () => {
  const news = [H('Solana ETF filing draws inflows', 3)];
  assert.equal(pickMoveNews(2.9, 'SOL', news, NOW), null);
  assert.ok(Math.abs(2.9) < MOVE_NEWS_PCT);
  assert.equal(pickMoveNews(4.2, 'SOL', [H('Bitcoin record high', 1)], NOW), null);
  assert.equal(pickMoveNews(-5, 'SOL', [H('Solana outage yesterday', 30)], NOW), null);
});

test('move news picks the most relevant recent headline and keeps source/time', () => {
  const news = [
    H('Markets mixed as traders pause', 1, { summary: 'solana mentioned only here', source: 'Wire' }),
    H('Solana jumps after new validator milestone', 2, { source: 'SoSoValue' }),
    H('Solana fee tweak', 20, { source: 'Desk' }),
  ];
  const pick = pickMoveNews(5.4, 'SOL', news, NOW);
  assert.ok(pick);
  assert.equal(pick.title, 'Solana jumps after new validator milestone');
  assert.equal(pick.source, 'SoSoValue');
  assert.equal(pick.time, NOW - 2 * 3600_000);
});

test('headline tone is conservative and does not invent sentiment', () => {
  assert.equal(headlineTone('Solana validators approve upgrade'), 'up');
  assert.equal(headlineTone('Exchange hack leads to a crash'), 'down');
  assert.equal(headlineTone('Solana network status update'), 'none');
});

function candlesFromAtr(entry: number, tr: number, n = 30): Candle[] {
  const out: Candle[] = [];
  let c = entry;
  for (let i = 0; i < n; i++) {
    const o = c;
    const h = o + tr / 2;
    const l = o - tr / 2;
    c = o;
    out.push({ t: i, o, h, l, c, v: 1 });
  }
  return out;
}

test('smart exit uses 1:2 reward-to-risk and sits on the correct side of entry', () => {
  const entry = 100;
  const s = suggestExit({ side: 'buy', entry, qty: 1.237, tick: '0.01', step: '0.001', candles: candlesFromAtr(entry, 2) });
  assert.ok(s);
  assert.equal(s.side, 'sell');
  const stop = Number(s.stop), tp = Number(s.takeProfit);
  assert.ok(stop < entry && tp > entry);
  const ratio = (tp - entry) / (entry - stop);
  assert.ok(Math.abs(ratio - REWARD_TO_RISK) < 0.15, `ratio ${ratio}`);
  assert.equal(s.qty, '1.237');
  assert.match(s.note, /not a guaranteed stop/);
});

test('smart exit for a sell pre-fills a buy limit below entry', () => {
  const entry = 50;
  const s = suggestExit({ side: 'sell', entry, qty: 2, tick: '0.01', step: '0.01', candles: candlesFromAtr(entry, 1) });
  assert.ok(s);
  assert.equal(s.side, 'buy');
  assert.ok(Number(s.takeProfit) < entry && Number(s.stop) > entry);
});

test('smart exit returns null without real volatility and floors qty to the lot step', () => {
  assert.equal(suggestExit({ side: 'buy', entry: 100, qty: 1, tick: '0.01', step: '0.001', candles: [] }), null);
  const s = suggestExit({ side: 'buy', entry: 10, qty: 1.2399, tick: '0.01', step: '0.01', candles: candlesFromAtr(10, 0.2) });
  assert.ok(s);
  assert.equal(s.qty, '1.23');
});

test('volatility can fall back to the live spread when candles are missing', () => {
  const v = volatilityUnit({ entry: 100, book: { bids: [{ price: 99.5, size: 1 }], asks: [{ price: 100.5, size: 1 }] } });
  assert.ok(v && v >= 2);
});

test('parseAskIntent reads the coin, side and optional size', () => {
  const bases = ['BTC', 'ETH', 'SOL'];
  assert.deepEqual(parseAskIntent('Should I buy SOL now?', bases), { base: 'SOL', side: 'buy', usd: undefined, amount: undefined });
  assert.equal(parseAskIntent('sell 0.5 ETH', bases)?.amount, 0.5);
  assert.equal(parseAskIntent('buy $200 of bitcoin', bases)?.usd, 200);
  assert.equal(parseAskIntent('buy $200 of bitcoin', bases)?.base, 'BTC');
  assert.equal(parseAskIntent('what is the weather', bases), null);
  assert.equal(parseAskIntent('should I sell solvent?', bases), null);
});

test('fallback ask reply never invents a price or drops the advice line', () => {
  const text = fallbackAskReply({
    base: 'SOL', side: 'buy', last: 142.16, changePct: 3.2,
    verdict: 'wait', reasons: ['Price impact is about 0.80%.'], sizeLabel: '$100',
  });
  assert.match(text, /\$142\.16/);
  assert.match(text, /\+3\.20%/);
  assert.match(text, /Wait/);
  assert.match(text, /not a prediction or financial advice/);
  assert.match(text, /will not place an order/);
  const empty = fallbackAskReply({});
  assert.match(empty, /could not tell which coin/i);
  assert.doesNotMatch(empty, /\$\d/);
});

test('formatUsd uses minus and compact units without inventing figures', () => {
  assert.equal(formatUsd(-120_000_000, 0), '−$120.0M');
  assert.equal(formatUsd(12.5, 2), '$12.50');
});

test('when spendable spot is zero, a safer size of the typed amount is still offered', () => {
  const evaluate = (amount: number): GuardInput => baseIn({
    amount, available: 0, isFromQuote: true, quoteDecimals: 6,
    notionalUsd: amount, coveragePct: amount <= 20 ? 100 : 40, impactPct: 0.1, portfolioUsd: null,
  });
  const safe = computeSafeSize(evaluate(25.5), evaluate);
  assert.ok(safe);
  assert.ok(Number(safe) <= 20 + 1e-9);
  assert.notEqual(computeGuard(evaluate(Number(safe))).verdict, 'risky');
});
