/**
 * Pure Trade Guard, smart-exit and move-news maths. No network, no keys, no AI.
 * Gemini may only rephrase reasons already produced here; it never changes a verdict or a number.
 */
import { atr, assetAliases, type Candle } from './setup';
import { decimalsOf, floorStep, fixedStr, stripZeros, QUOTE_DECIMALS } from './swap-ux';
import { walkBook, type Level } from './risk';

export const MOVE_NEWS_PCT = 3;
export const NEWS_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PORTFOLIO_RISKY_PCT = 40;
export const PORTFOLIO_WAIT_PCT = 20;
export const IMPACT_RISKY_PCT = 2;
export const IMPACT_WAIT_PCT = 0.5;
export const SPREAD_RISKY_PCT = 1;
export const SPREAD_WAIT_PCT = 0.3;
export const RANGE_WAIT_PCT = 15;
export const VOL_SHARE_WAIT_PCT = 2;
export const COST_WAIT_PCT = 1.5;
export const ETF_LARGE_USD = 50_000_000;
export const REWARD_TO_RISK = 2;
export const ATR_PERIOD = 14;
export const MIN_STOP_PCT = 0.3;

export type GuardVerdict = 'good' | 'wait' | 'risky';
export type NewsHeadline = { title: string; time: number; summary?: string; source?: string; url?: string };
export type EtfSnapshot = { asset: 'BTC' | 'ETH'; date: string; inflow: number };
export type BookSide = { bids: Level[]; asks: Level[] };

export type GuardInput = {
  amount: number;
  available: number;
  isFromQuote: boolean;
  fromStep?: string;
  quoteDecimals?: number;
  notionalUsd: number;
  feeUsd: number;
  builderFeeUsd?: number;
  impactPct: number;
  spreadPct: number;
  coveragePct: number;
  rangePct?: number;
  volShare?: number;
  halted?: boolean;
  bookReady?: boolean;
  /** Spot portfolio in USD. Omit or null when unknown — the line is hidden. */
  portfolioUsd?: number | null;
  news?: NewsHeadline[] | null;
  newsLoaded?: boolean;
  etf?: EtfSnapshot | null;
  etfLoaded?: boolean;
  now?: number;
  /** Non-stable asset the mood is about (e.g. SOL). */
  base?: string;
  /** Direction of that asset: buy = acquiring it, sell = disposing of it. */
  side?: 'buy' | 'sell';
};

export type MoodInfo = { tone: 'up' | 'down' | 'mixed' | 'noted'; text: string };
export type GuardResult = {
  verdict: GuardVerdict;
  reasons: string[];
  costUsd?: number;
  costParts?: { fees: number; spread: number; slippage: number };
  mood?: MoodInfo;
  depthText?: string;
  portfolioText?: string;
};

const fin = (n: number | undefined) => (Number.isFinite(n) ? Number(n) : 0);

export function formatUsd(n: number, d = 2): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e10 ? 1 : 2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 1)}M`;
  if (a >= 1000) return `${sign}$${a.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `${sign}$${a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function headlinesInWindow(news: NewsHeadline[] | null | undefined, now: number): NewsHeadline[] {
  if (!news) return [];
  return news.filter((n) => n.time > 0 && now - n.time >= 0 && now - n.time <= NEWS_WINDOW_MS && (n.title || '').trim());
}

export function textMentionsBase(text: string, base: string): boolean {
  const src = text.toLowerCase();
  if (!src.trim() || !base) return false;
  for (const alias of assetAliases(base)) {
    const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRe(alias)}(?![A-Za-z0-9_])`, 'i');
    if (re.test(src)) return true;
  }
  return false;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchingHeadlines(news: NewsHeadline[] | null | undefined, base: string, now: number): NewsHeadline[] {
  return headlinesInWindow(news, now).filter((n) => textMentionsBase(`${n.title} ${n.summary ?? ''}`, base));
}

const POS_RE = /\b(rally|rallies|surge|surges|soars?|soar|record high|all-?time high|\bath\b|approves?|approval|inflows?|beats?|partnership|upgrade[ds]?|accumulation|bullish|breakout|jumps?|rallied)\b/i;
const NEG_RE = /\b(crash(?:es|ed)?|plunge[ds]?|lawsuit|hack(?:ed|s)?|outflows?|bans?|banned|delays?|delayed|rejects?|rejected|exploit|insolvency|sell-?off|dumps?|fraud|bearish|slump|collapse[ds]?|liquidat(?:e|ed|ion)s?)\b/i;

export function headlineTone(text: string): 'up' | 'down' | 'none' {
  const up = POS_RE.test(text);
  const down = NEG_RE.test(text);
  if (up && !down) return 'up';
  if (down && !up) return 'down';
  return 'none';
}

export function newsMood(base: string, news: NewsHeadline[] | null | undefined, now: number): { tone: 'up' | 'down' | 'mixed' | 'noted'; count: number; text: string } | null {
  if (!base) return null;
  const hits = matchingHeadlines(news, base, now);
  if (!hits.length) return null;
  let up = 0, down = 0;
  for (const h of hits) {
    const t = headlineTone(`${h.title} ${h.summary ?? ''}`);
    if (t === 'up') up++;
    if (t === 'down') down++;
  }
  const tone: 'up' | 'down' | 'mixed' | 'noted' = up && down ? 'mixed' : up ? 'up' : down ? 'down' : 'noted';
  const word = hits.length === 1 ? 'headline' : 'headlines';
  const toneBit = tone === 'up' ? ', leaning positive' : tone === 'down' ? ', leaning negative' : tone === 'mixed' ? ', mixed tone' : '';
  return { tone, count: hits.length, text: `${hits.length} ${base} ${word} in the last 24h${toneBit}.` };
}

export function etfMood(etf: EtfSnapshot | null | undefined): { text: string; outflow: boolean; inflow: boolean; large: boolean } | null {
  if (!etf || !etf.asset || !etf.date) return null;
  if (!Number.isFinite(etf.inflow)) return null;
  const day = String(etf.date).slice(0, 10) || 'the latest day';
  const sign = etf.inflow >= 0 ? '+' : '−';
  const large = Math.abs(etf.inflow) >= ETF_LARGE_USD;
  return {
    text: `US spot ${etf.asset} ETFs: ${sign}${formatUsd(Math.abs(etf.inflow), 0)} net on ${day}.`,
    outflow: etf.inflow < 0,
    inflow: etf.inflow > 0,
    large,
  };
}

export function combineMood(input: GuardInput): MoodInfo | undefined {
  const now = input.now ?? Date.now();
  const newsPart = input.newsLoaded && input.base ? newsMood(input.base, input.news, now) : null;
  const etfPart = input.etfLoaded ? etfMood(input.etf) : null;
  if (!newsPart && !etfPart) return undefined;
  const text = [newsPart?.text, etfPart?.text].filter(Boolean).join(' ');
  let tone: MoodInfo['tone'] = newsPart?.tone ?? 'noted';
  if (!newsPart && etfPart) tone = etfPart.outflow ? 'down' : etfPart.inflow ? 'up' : 'noted';
  return { tone, text };
}

export function tradeCost(input: Pick<GuardInput, 'notionalUsd' | 'feeUsd' | 'builderFeeUsd' | 'impactPct' | 'spreadPct' | 'bookReady'>): { costUsd: number; parts: { fees: number; spread: number; slippage: number } } | null {
  if (input.bookReady === false) return null;
  if (!(input.notionalUsd > 0)) return null;
  const fees = Math.max(0, fin(input.feeUsd) + fin(input.builderFeeUsd));
  const spread = Math.max(0, (fin(input.spreadPct) / 100) * input.notionalUsd * 0.5);
  const slippage = Math.max(0, (fin(input.impactPct) / 100) * input.notionalUsd);
  return { costUsd: fees + spread + slippage, parts: { fees, spread, slippage } };
}

export function portfolioShare(notionalUsd: number, portfolioUsd: number | null | undefined): number | null {
  if (portfolioUsd == null || !(portfolioUsd > 0) || !(notionalUsd >= 0)) return null;
  return (notionalUsd / portfolioUsd) * 100;
}

export function computeGuard(input: GuardInput): GuardResult {
  const reasons: string[] = [];
  const bad: string[] = [];
  const warn: string[] = [];
  const cost = tradeCost(input);
  const mood = combineMood(input);
  const share = portfolioShare(input.notionalUsd, input.portfolioUsd);

  let depthText: string | undefined;
  if (input.bookReady !== false && input.notionalUsd > 0) {
    const cov = fin(input.coveragePct);
    depthText = cov >= 99.9
      ? 'Visible depth covers this size.'
      : `Visible depth covers ${Math.max(0, Math.min(100, cov)).toFixed(0)}% of this size.`;
  }
  let portfolioText: string | undefined;
  if (share != null) portfolioText = `This is ${share < 0.1 ? '<0.1' : share.toFixed(share < 10 ? 1 : 0)}% of your spot portfolio.`;

  if (input.halted) bad.push('This market is not in trading status right now.');
  if (input.bookReady === false) {
    /* Book missing: hide cost/depth, do not invent a verdict from empty books. */
  } else {
    if (!fin(input.spreadPct) && !(fin(input.coveragePct) > 0) && input.notionalUsd > 0) {
      bad.push('The order book is empty on one side. A market order could fill at a very bad price.');
    }
    if (input.notionalUsd > 0 && fin(input.coveragePct) < 99.9 && fin(input.coveragePct) >= 0) {
      bad.push(`Visible depth covers only ${fin(input.coveragePct).toFixed(0)}% of this size.`);
    }
    if (fin(input.impactPct) > IMPACT_RISKY_PCT) bad.push(`Price impact is about ${input.impactPct.toFixed(2)}%.`);
    else if (fin(input.impactPct) > IMPACT_WAIT_PCT) warn.push(`Price impact is about ${input.impactPct.toFixed(2)}%. Consider a smaller size.`);
    if (fin(input.spreadPct) > SPREAD_RISKY_PCT) bad.push(`Spread is ${input.spreadPct.toFixed(2)}%, which is very wide.`);
    else if (fin(input.spreadPct) > SPREAD_WAIT_PCT) warn.push(`Spread is ${input.spreadPct.toFixed(2)}%, wider than a liquid pair.`);
  }
  if (share != null && share > PORTFOLIO_RISKY_PCT) bad.push(`This size is ${share.toFixed(0)}% of your spot portfolio.`);
  else if (share != null && share > PORTFOLIO_WAIT_PCT) warn.push(`This size is ${share.toFixed(0)}% of your spot portfolio.`);
  if (fin(input.rangePct) > RANGE_WAIT_PCT) warn.push(`The 24h range is ${input.rangePct!.toFixed(1)}%: the price is very volatile.`);
  if (fin(input.volShare) > VOL_SHARE_WAIT_PCT) warn.push(`This order is ${input.volShare!.toFixed(2)}% of the pair's 24h volume.`);
  if (cost && input.notionalUsd > 0) {
    const costPct = (cost.costUsd / input.notionalUsd) * 100;
    if (costPct > COST_WAIT_PCT) warn.push(`Fees, spread and slippage come to about ${costPct.toFixed(2)}% (${formatUsd(cost.costUsd, 2)}) before the price moves.`);
  }
  const etf = input.etfLoaded ? etfMood(input.etf) : null;
  if (etf?.large && etf.outflow && input.side === 'buy') warn.push(`US spot ${input.etf!.asset} ETFs posted a large net outflow on the latest day.`);
  if (etf?.large && etf.inflow && input.side === 'sell') warn.push(`US spot ${input.etf!.asset} ETFs posted a large net inflow on the latest day.`);
  if (mood?.tone === 'down' && input.side === 'buy') warn.push('Recent headlines mentioning this coin lean negative.');
  if (mood?.tone === 'up' && input.side === 'sell') warn.push('Recent headlines mentioning this coin lean positive.');

  const verdict: GuardVerdict = bad.length ? 'risky' : warn.length ? 'wait' : 'good';
  if (verdict === 'good') {
    if (cost) reasons.push(`Estimated cost is ${formatUsd(cost.costUsd, 2)} in fees, spread and slippage.`);
    if (depthText) reasons.push(depthText);
    if (mood) reasons.push(mood.text);
    if (!reasons.length) reasons.push('No liquidity, size or market-data warnings at this size.');
  } else {
    reasons.push(...bad, ...warn);
  }
  return {
    verdict,
    reasons: reasons.slice(0, 3),
    costUsd: cost?.costUsd,
    costParts: cost?.parts,
    mood,
    depthText,
    portfolioText,
  };
}

export function formatAmount(amount: number, opts: { isFromQuote: boolean; fromStep?: string; quoteDecimals?: number }): string {
  if (!(amount > 0) || !Number.isFinite(amount)) return '0';
  if (opts.isFromQuote) return fixedStr(amount, opts.quoteDecimals ?? QUOTE_DECIMALS);
  if (!opts.fromStep) return '0';
  return floorStep(amount, opts.fromStep);
}

/**
 * Largest amount at or below current, floored to the lot step and spendable spot only,
 * whose Trade Guard verdict is not Risky. Null when no safer size exists (halt, empty book, etc.).
 */
export function computeSafeSize(input: GuardInput, evaluate: (amount: number) => GuardInput): string | null {
  const current = computeGuard(input);
  if (current.verdict !== 'risky') return null;
  if (input.halted) return null;
  if (input.bookReady === false) return null;
  const cap = input.available > 0
    ? Math.min(Math.max(0, input.amount), input.available)
    : Math.max(0, input.amount);
  if (!(cap > 0)) return null;

  const minAmt = input.isFromQuote
    ? 1 / 10 ** (input.quoteDecimals ?? QUOTE_DECIMALS)
    : Number(input.fromStep || 0);
  if (!(minAmt > 0) || cap < minAmt) return null;

  const verdictAt = (amt: number) => computeGuard(evaluate(amt)).verdict;
  if (verdictAt(minAmt) === 'risky') return null;

  let lo = minAmt, hi = cap, best = 0;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const shown = Number(formatAmount(mid, input));
    if (!(shown > 0)) { hi = mid; continue; }
    if (verdictAt(shown) !== 'risky') { best = shown; lo = mid; }
    else hi = mid;
  }
  const nicest = () => {
    if (input.isFromQuote) {
      const cents = formatAmount(best, { ...input, quoteDecimals: 2 });
      const c = Number(cents);
      if (c > 0 && c <= (input.available > 0 ? input.available : cap) && verdictAt(c) !== 'risky') return cents;
    }
    return formatAmount(best, input);
  };
  const sized = nicest();
  const n = Number(sized);
  if (!(n > 0) || n >= cap - minAmt * 0.5) return null;
  if (input.available > 0 && n > input.available + 1e-12) return null;
  if (verdictAt(n) === 'risky') return null;
  return sized;
}

/** Most relevant 24h headline for a coin that moved at least MOVE_NEWS_PCT. */
export function pickMoveNews(changePct: number, base: string, news: NewsHeadline[] | null | undefined, now: number): NewsHeadline | null {
  if (!Number.isFinite(changePct) || Math.abs(changePct) < MOVE_NEWS_PCT) return null;
  const hits = matchingHeadlines(news, base, now);
  if (!hits.length) return null;
  const dir = changePct >= 0 ? 'up' : 'down';
  const score = (h: NewsHeadline) => {
    const titleHit = textMentionsBase(h.title, base) ? 4 : 0;
    const summaryHit = textMentionsBase(h.summary ?? '', base) ? 1 : 0;
    const tone = headlineTone(`${h.title} ${h.summary ?? ''}`);
    const dirHit = tone === dir ? 2 : tone === 'none' ? 0 : -1;
    const ageH = Math.max(0, (now - h.time) / 3_600_000);
    const recency = Math.max(0, 24 - ageH) / 24;
    return titleHit + summaryHit + dirHit + recency;
  };
  return [...hits].sort((a, b) => score(b) - score(a) || b.time - a.time)[0] ?? null;
}

export type ExitSuggestion = {
  side: 'buy' | 'sell';
  stop: string;
  takeProfit: string;
  entry: string;
  qty: string;
  riskPerUnit: number;
  rewardPerUnit: number;
  atr: number | null;
  note: string;
};

function roundTick(x: number, tick: string): string {
  const t = Number(tick);
  if (!(t > 0) || !Number.isFinite(x)) return '0';
  return stripZeros((Math.round(x / t) * t).toFixed(decimalsOf(tick)));
}

function meanTr(candles: Candle[]): number | null {
  if (candles.length < 3) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  if (!trs.length) return null;
  const m = trs.reduce((s, x) => s + x, 0) / trs.length;
  return m > 0 && Number.isFinite(m) ? m : null;
}

export function volatilityUnit(opts: { candles?: Candle[]; entry: number; book?: BookSide | null }): number | null {
  const entry = opts.entry;
  if (!(entry > 0)) return null;
  let v: number | null = null;
  if (opts.candles && opts.candles.length) v = atr(opts.candles, ATR_PERIOD) ?? meanTr(opts.candles);
  if (v == null && opts.book) {
    const bid = opts.book.bids[0]?.price ?? 0;
    const ask = opts.book.asks[0]?.price ?? 0;
    if (bid > 0 && ask > 0 && ask > bid) v = (ask - bid) * 2;
  }
  if (v == null || !(v > 0)) return null;
  return Math.max(v, entry * (MIN_STOP_PCT / 100));
}

export function suggestExit(opts: {
  side: 'buy' | 'sell';
  entry: number;
  qty: number;
  tick: string;
  step: string;
  candles?: Candle[];
  book?: BookSide | null;
}): ExitSuggestion | null {
  const { side, entry, qty, tick, step } = opts;
  if (!(entry > 0) || !(qty > 0) || !tick || !step) return null;
  const risk = volatilityUnit({ candles: opts.candles, entry, book: opts.book });
  if (risk == null) return null;
  const reward = risk * REWARD_TO_RISK;
  const rawStop = side === 'buy' ? entry - risk : entry + risk;
  const rawTp = side === 'buy' ? entry + reward : entry - reward;
  if (!(rawStop > 0) || !(rawTp > 0)) return null;

  let stopN = Number(roundTick(rawStop, tick));
  let tpN = Number(roundTick(rawTp, tick));
  const tickN = Number(tick);
  if (side === 'buy') {
    if (!(stopN < entry) && tickN > 0) stopN = Number(roundTick(entry - tickN, tick));
    if (!(tpN > entry) && tickN > 0) tpN = Number(roundTick(entry + tickN * 2, tick));
    if (!(stopN > 0) || !(stopN < entry) || !(tpN > entry)) return null;
  } else {
    if (!(stopN > entry) && tickN > 0) stopN = Number(roundTick(entry + tickN, tick));
    if (!(tpN < entry) && tickN > 0) tpN = Number(roundTick(entry - tickN * 2, tick));
    if (!(tpN > 0) || !(stopN > entry) || !(tpN < entry)) return null;
  }
  const qtyStr = floorStep(qty, step);
  if (Number(qtyStr) <= 0) return null;
  const atrUsed = opts.candles && opts.candles.length ? atr(opts.candles, ATR_PERIOD) : null;
  const source = atrUsed != null ? '14-period ATR from recent candles' : opts.candles && opts.candles.length >= 3 ? 'recent candle ranges' : 'the live spread';
  return {
    side: side === 'buy' ? 'sell' : 'buy',
    stop: roundTick(stopN, tick),
    takeProfit: roundTick(tpN, tick),
    entry: roundTick(entry, tick),
    qty: qtyStr,
    riskPerUnit: Math.abs(entry - stopN),
    rewardPerUnit: Math.abs(tpN - entry),
    atr: atrUsed,
    note: `Take-profit is set at 2× the stop distance, using ${source}. A limit at the stop price is not a guaranteed stop. You still review and sign the order.`,
  };
}

export type AskIntent = { base: string; side: 'buy' | 'sell'; usd?: number; amount?: number };

const NAME_TO_BASE: Record<string, string> = {
  bitcoin: 'BTC', btc: 'BTC', wbtc: 'BTC',
  ethereum: 'ETH', ether: 'ETH', eth: 'ETH', weth: 'ETH',
  solana: 'SOL', sol: 'SOL',
  dogecoin: 'DOGE', doge: 'DOGE',
  ripple: 'XRP', xrp: 'XRP',
  cardano: 'ADA', ada: 'ADA',
  litecoin: 'LTC', ltc: 'LTC',
  polkadot: 'DOT', dot: 'DOT',
  avalanche: 'AVAX', avax: 'AVAX',
  chainlink: 'LINK', link: 'LINK',
  hyperliquid: 'HYPE', hype: 'HYPE',
  sosovalue: 'SOSO', soso: 'SOSO',
};

export function parseAskIntent(text: string, bases: string[]): AskIntent | null {
  const raw = (text || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const sell = /\b(sell|short|dump|exit|offload)\b/.test(lower);
  const buy = /\b(buy|long|accumulate|pick up|get some)\b/.test(lower);
  const side: 'buy' | 'sell' = sell && !buy ? 'sell' : 'buy';

  const canon = new Map<string, string>();
  for (const b of bases) {
    const k = b.replace(/^v/i, '').replace(/^W/i, '').toUpperCase();
    canon.set(k, k);
    for (const a of assetAliases(b)) canon.set(a.toLowerCase(), k);
  }
  for (const [alias, base] of Object.entries(NAME_TO_BASE)) {
    if (bases.some((b) => b.replace(/^v/i, '').replace(/^W/i, '').toUpperCase() === base)) canon.set(alias, base);
  }

  let found: { base: string; index: number; len: number } | null = null;
  for (const [alias, base] of canon) {
    const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRe(alias)}(?![A-Za-z0-9_])`, 'i');
    const m = re.exec(raw);
    if (!m) continue;
    if (!found || m.index < found.index || (m.index === found.index && alias.length > found.len)) {
      found = { base, index: m.index, len: alias.length };
    }
  }
  if (!found) return null;

  const usdM = raw.match(/\$\s*(\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?)\s*(?:usd|usdc)\b/i);
  const usd = usdM ? Number(usdM[1] || usdM[2]) : undefined;
  const amtRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escapeRe(found.base)}\\b`, 'i');
  const amtM = raw.match(amtRe);
  const amount = amtM ? Number(amtM[1]) : undefined;
  return {
    base: found.base,
    side,
    usd: usd && usd > 0 ? usd : undefined,
    amount: amount && amount > 0 ? amount : undefined,
  };
}

export function fallbackAskReply(opts: {
  base?: string;
  side?: 'buy' | 'sell';
  last?: number;
  changePct?: number;
  verdict?: GuardVerdict | null;
  reasons?: string[];
  sizeLabel?: string;
  moodText?: string;
  etfText?: string;
}): string {
  const bits: string[] = [];
  if (opts.base && opts.last != null && Number.isFinite(opts.last)) {
    const chg = opts.changePct != null && Number.isFinite(opts.changePct)
      ? ` (${opts.changePct >= 0 ? '+' : ''}${opts.changePct.toFixed(2)}% over 24h)`
      : '';
    bits.push(`${opts.base} is trading at ${formatUsd(opts.last, opts.last >= 1 ? 2 : 4)} on SoDEX${chg}.`);
  } else if (opts.base) {
    bits.push(`I could not read a live ${opts.base} price from SoDEX right now.`);
  } else {
    bits.push('I could not tell which coin you mean. Try asking about a SoDEX pair such as SOL or BTC.');
  }
  if (opts.verdict && opts.base) {
    const label = opts.verdict === 'good' ? 'Good to go' : opts.verdict === 'wait' ? 'Wait' : 'Risky';
    const size = opts.sizeLabel ? ` at ${opts.sizeLabel}` : '';
    bits.push(`Trade Guard rates a ${opts.side ?? 'buy'}${size} as ${label}.`);
    if (opts.reasons?.[0]) bits.push(opts.reasons[0]);
  }
  if (opts.moodText) bits.push(opts.moodText);
  if (opts.etfText) bits.push(opts.etfText);
  bits.push('This is a snapshot of live data, not a prediction or financial advice. SoSwapDEX will not place an order — you review and sign it yourself.');
  return bits.join(' ');
}

/** Book coverage / impact / mid spread for a USD notional on one side. */
export function bookMetrics(book: BookSide | undefined, side: 'buy' | 'sell', usd: number): { coveragePct: number; impactPct: number; spreadPct: number; mid: number } | null {
  if (!book) return null;
  const bid = book.bids[0]?.price ?? 0;
  const ask = book.asks[0]?.price ?? 0;
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;
  const spreadPct = bid > 0 && ask > 0 && mid > 0 ? ((ask - bid) / mid) * 100 : 0;
  const w = walkBook(side === 'buy' ? book.asks : book.bids, usd);
  return { coveragePct: w.coverage * 100, impactPct: w.impactPct, spreadPct, mid };
}
