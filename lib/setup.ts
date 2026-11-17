/* Deterministic spot-buy setup engine for the SoSwapDEX Bots "AI Setup Builder".
 * Pure functions: no network, no AI. Gemini may only explain these numbers. */

import { sizePosition, walkBook, type Flag, type Level } from '@/lib/risk';

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
export type SetupGrade = 'A' | 'B' | 'C' | 'no-trade';
export type Trend = 'up' | 'down' | 'sideways' | 'unknown';

export type SetupContext = {
  headlines?: string[];
  newsStatus?: 'ok' | 'missing' | 'unconfigured';
  etf?: { asset: 'BTC' | 'ETH'; date: string; inflow: number } | null;
  etfStatus?: 'ok' | 'missing' | 'unconfigured' | 'n/a';
};

export type SetupIn = {
  pair: string;
  display: string;
  base: string;
  candles: Candle[];
  bids: Level[];
  asks: Level[];
  last: number;
  quoteVol: number;
  takerFee: number;
  halted: boolean;
  minNotional?: number;
  equity: number;
  riskPct: number;
  interval?: string;
  context?: SetupContext;
};

export type SetupOut = {
  pair: string;
  display: string;
  base: string;
  interval: string;
  grade: SetupGrade;
  trend: Trend;
  ema20: number | null;
  ema50: number | null;
  atr: number | null;
  support: number | null;
  resistance: number | null;
  resistance2: number | null;
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  rr1: number;
  rr2: number;
  qty: number;
  notional: number;
  maxLoss: number;
  stopDistPct: number;
  spreadPct: number;
  impactPct: number;
  coveragePct: number;
  candlesUsed: number;
  flags: Flag[];
  reasons: string[];
  newsNote: string;
  etfNote: string;
};

const fin = (n: number) => (Number.isFinite(n) ? n : 0);

export function ema(values: number[], period: number): number | null {
  if (values.length < period || period < 1) return null;
  const k = 2 / (period + 1);
  let e = 0;
  for (let i = 0; i < period; i++) e += values[i];
  e /= period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return Number.isFinite(e) ? e : null;
}

/** Wilder ATR; needs period+1 candles. */
export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  if (trs.length < period) return null;
  let a = trs.slice(0, period).reduce((s, x) => s + x, 0) / period;
  for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
  return a > 0 && Number.isFinite(a) ? a : null;
}

function swings(candles: Candle[], left = 3) {
  const highs: number[] = [], lows: number[] = [];
  for (let i = left; i < candles.length - left; i++) {
    let isH = true, isL = true;
    for (let j = 1; j <= left; j++) {
      if (candles[i].h < candles[i - j].h || candles[i].h < candles[i + j].h) isH = false;
      if (candles[i].l > candles[i - j].l || candles[i].l > candles[i + j].l) isL = false;
    }
    if (isH) highs.push(candles[i].h);
    if (isL) lows.push(candles[i].l);
  }
  return { highs, lows };
}

/** Merge prices that sit within pct of each other into a single mid level. */
function cluster(levels: number[], pct = 0.004): number[] {
  if (!levels.length) return [];
  const s = [...levels].sort((a, b) => a - b);
  const out: number[] = [];
  let bucket = [s[0]];
  for (let i = 1; i < s.length; i++) {
    const mid = bucket.reduce((a, b) => a + b, 0) / bucket.length;
    if (Math.abs(s[i] - mid) / mid <= pct) bucket.push(s[i]);
    else { out.push(bucket.reduce((a, b) => a + b, 0) / bucket.length); bucket = [s[i]]; }
  }
  out.push(bucket.reduce((a, b) => a + b, 0) / bucket.length);
  return out;
}

function trendOf(close: number, e20: number | null, e50: number | null): Trend {
  if (e20 == null || e50 == null || !(close > 0)) return 'unknown';
  if (e20 > e50 * 1.001 && close > e20) return 'up';
  if (e20 < e50 * 0.999 && close < e20) return 'down';
  return 'sideways';
}

function noteNews(ctx: SetupContext | undefined, base: string): string {
  if (!ctx) return 'SoSoValue news was not loaded for this setup, so only SoDEX market data was used.';
  if (ctx.newsStatus === 'unconfigured') return 'SoSoValue news is not configured on this deployment, so only SoDEX market data was used.';
  if (ctx.newsStatus === 'missing') return 'SoSoValue news was unavailable, so only SoDEX market data was used.';
  const heads = (ctx.headlines ?? []).map((t) => t.trim()).filter(Boolean);
  if (!heads.length) return `No recent SoSoValue headlines mentioned ${base}.`;
  return `Recent headlines mentioning ${base}: ${heads.slice(0, 3).join(' · ')}`;
}

function noteEtf(ctx: SetupContext | undefined): string {
  if (!ctx || ctx.etfStatus === 'n/a') return '';
  if (ctx.etfStatus === 'unconfigured') return 'SoSoValue ETF flow data is not configured on this deployment.';
  if (ctx.etfStatus === 'missing' || !ctx.etf) return 'SoSoValue ETF flow data was unavailable.';
  const { asset, date, inflow } = ctx.etf;
  const day = String(date).slice(0, 10) || 'the latest day';
  const mag = Math.abs(inflow);
  const money = mag >= 1e9 ? `$${(mag / 1e9).toFixed(2)}B` : mag >= 1e6 ? `$${(mag / 1e6).toFixed(1)}M` : `$${Math.round(mag).toLocaleString('en-US')}`;
  return `US spot ${asset} ETF net flow on ${day}: ${inflow >= 0 ? '+' : '−'}${money}.`;
}

export function computeSetup(i: SetupIn): SetupOut {
  const interval = i.interval || '1h';
  const flags: Flag[] = [];
  const reasons: string[] = [];
  const add = (sev: Flag['sev'], text: string) => flags.push({ sev, text });

  const candles = [...i.candles].filter((c) => c && c.c > 0 && c.h > 0 && c.l > 0).sort((a, b) => a.t - b.t);
  const closes = candles.map((c) => c.c);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const atr14 = atr(candles, 14);
  const close = closes.length ? closes[closes.length - 1] : 0;
  const trend = trendOf(close, e20, e50);

  const bid = i.bids[0]?.price ?? 0;
  const ask = i.asks[0]?.price ?? 0;
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : i.last || close;
  const entry = ask > 0 ? ask : mid;
  const spreadPct = bid > 0 && ask > 0 && mid > 0 ? ((ask - bid) / mid) * 100 : 0;

  const { highs, lows } = swings(candles);
  const resLevels = cluster(highs).filter((p) => p > entry * 1.001).sort((a, b) => a - b);
  const supLevels = cluster(lows).filter((p) => p < entry * 0.999).sort((a, b) => b - a);
  // Fallback: 20-bar high/low when swings are scarce
  const window = candles.slice(-20);
  if (!resLevels.length && window.length) {
    const hi = Math.max(...window.map((c) => c.h));
    if (hi > entry * 1.001) resLevels.push(hi);
  }
  if (!supLevels.length && window.length) {
    const lo = Math.min(...window.map((c) => c.l));
    if (lo < entry * 0.999) supLevels.push(lo);
  }
  const resistance = resLevels[0] ?? null;
  const resistance2 = resLevels[1] ?? null;
  let support = supLevels[0] ?? null;

  let stop = 0, tp1 = 0, tp2 = 0, rr1 = 0, rr2 = 0;
  if (entry > 0 && atr14 && atr14 > 0) {
    const atrStop = entry - 1.5 * atr14;
    if (support && support < entry) {
      const dist = entry - support;
      // Snap the stop under nearby support when it is a sensible ATR multiple.
      if (dist >= 0.8 * atr14 && dist <= 2.5 * atr14) stop = support - 0.1 * atr14;
      else stop = atrStop;
    } else {
      stop = atrStop;
    }
    if (!(stop > 0) || stop >= entry) stop = atrStop;
    const risk = entry - stop;
    if (risk > 0) {
      const default1 = entry + 2 * risk;
      const default2 = entry + 3 * risk;
      if (resistance && (resistance - entry) / risk >= 2) {
        tp1 = resistance;
        tp2 = resistance2 && (resistance2 - entry) / risk >= 3 ? resistance2 : Math.max(default2, resistance + risk);
      } else {
        tp1 = default1;
        tp2 = resistance2 && (resistance2 - entry) / risk >= 3 ? resistance2 : default2;
      }
      rr1 = (tp1 - entry) / risk;
      rr2 = (tp2 - entry) / risk;
    }
  }

  const sized = (entry > 0 && stop > 0 && stop < entry && i.equity > 0 && i.riskPct > 0)
    ? sizePosition({ equity: i.equity, riskPct: i.riskPct, entry, stop, feePct: fin(i.takerFee) * 100 })
    : null;
  const qty = sized?.qty ?? 0;
  const notional = sized?.notional ?? 0;
  const maxLoss = sized?.maxLoss ?? 0;
  const stopDistPct = sized?.stopDistPct ?? (entry > 0 && stop > 0 ? ((entry - stop) / entry) * 100 : 0);
  if (sized?.flags.length) flags.push(...sized.flags);

  const book = notional > 0 ? walkBook(i.asks, notional) : walkBook(i.asks, 0);
  const coveragePct = book.coverage * 100;
  const impactPct = book.impactPct;

  const newsNote = noteNews(i.context, i.base);
  const etfNote = noteEtf(i.context);
  const outflow = i.context?.etf && i.context.etf.inflow < -100_000_000;
  if (outflow && i.context?.etf) {
    add('warn', `US spot ${i.context.etf.asset} ETFs posted a large net outflow on the latest day in the SoSoValue feed.`);
  }
  if (resistance && stop > 0 && (resistance - entry) / (entry - stop) < 0.8) {
    add('warn', `The nearest resistance at this timeframe sits close to entry and may cap the move before the first target.`);
  }

  let grade: SetupGrade = 'C';
  const hard: string[] = [];
  if (i.halted) hard.push('This market is not trading right now.');
  if (candles.length < 50) hard.push('Not enough 1-hour candles to measure the EMA20/50 trend.');
  else if (!atr14) hard.push('Not enough 1-hour candles to measure ATR.');
  if (!(entry > 0)) hard.push('No live buy price is available on the order book.');
  if (!bid || !ask) hard.push('The order book is empty on one side.');
  if (spreadPct > 1) hard.push(`The spread is ${spreadPct.toFixed(2)}%, which is too wide for a clean entry.`);
  if (trend === 'down') hard.push('The 1-hour trend is down (EMA20 below EMA50 and price below EMA20). This builder only suggests spot buys.');
  if (!(stop > 0 && stop < entry)) hard.push('A valid stop could not be placed below entry.');
  if (rr1 > 0 && rr1 < 2) hard.push(`Reward-to-risk at the first target is 1:${rr1.toFixed(2)}, below the 1:2 minimum.`);
  if (notional > 0 && coveragePct < 99.9) hard.push(`Visible buy-side depth covers only ${coveragePct.toFixed(0)}% of this size.`);
  if (notional > 0 && impactPct > 2) hard.push(`Price impact at this size is about ${impactPct.toFixed(2)}%.`);
  if (sized && notional > i.equity) hard.push('The position would be larger than the account size. Spot markets have no leverage, so this is skipped.');
  if (i.minNotional && notional > 0 && notional < i.minNotional) hard.push('The computed size is below this market’s minimum order value.');
  if (resistance && stop > 0 && (resistance - entry) / (entry - stop) < 0.8) {
    hard.push('A ceiling is too close to entry for a 1:2 target to be realistic.');
  }
  if (!(i.equity > 0 && i.riskPct > 0)) hard.push('Enter an account size and a risk percent first.');

  if (hard.length) {
    grade = 'no-trade';
    reasons.push(...hard);
  } else {
    const aOk = trend === 'up'
      && spreadPct <= 0.2
      && impactPct <= 0.3
      && coveragePct >= 99.9
      && rr1 >= 2.5
      && !outflow
      && !(resistance && stop > 0 && (resistance - entry) / (entry - stop) < 1.5);
    const bOk = (trend === 'up' || trend === 'sideways') && spreadPct <= 0.3 && impactPct <= 0.8 && rr1 >= 2;
    grade = aOk ? 'A' : bOk ? 'B' : 'C';
    reasons.push(
      trend === 'up' ? 'The 1-hour trend is up (EMA20 above EMA50, price above EMA20).'
        : trend === 'sideways' ? 'The 1-hour trend is sideways, so this is a weaker setup.'
        : 'Trend could not be classified cleanly.',
    );
    reasons.push(`Reward-to-risk is 1:${rr1.toFixed(2)} to the first target and 1:${rr2.toFixed(2)} to the second.`);
    if (spreadPct > 0.3) add('warn', `Spread is ${spreadPct.toFixed(2)}%, which is wide for a liquid pair.`);
    else if (spreadPct > 0.15) add('info', `Spread is ${spreadPct.toFixed(2)}%.`);
    if (impactPct > 0.5) add('warn', `Price impact at this size is about ${impactPct.toFixed(2)}%.`);
    if (!flags.some((f) => f.sev !== 'info') && !flags.length) add('info', 'No liquidity, spread or size warnings at this risk setting.');
    if (grade === 'A') reasons.push('Passed the tight spread, depth and trend checks for a grade A setup.');
    else if (grade === 'B') reasons.push('Passed the hard rules, with some caution on trend, spread or depth.');
    else reasons.push('Passed the hard rules, but several caution flags keep this at grade C.');
  }

  if (!flags.length && grade === 'no-trade') {
    // reasons already explain the skip
  } else if (!flags.length) {
    add('info', 'No extra liquidity or size warnings at this risk setting.');
  }

  return {
    pair: i.pair,
    display: i.display,
    base: i.base,
    interval,
    grade,
    trend,
    ema20: e20,
    ema50: e50,
    atr: atr14,
    support,
    resistance,
    resistance2,
    entry,
    stop,
    tp1,
    tp2,
    rr1,
    rr2,
    qty,
    notional,
    maxLoss,
    stopDistPct,
    spreadPct,
    impactPct,
    coveragePct,
    candlesUsed: candles.length,
    flags,
    reasons,
    newsNote,
    etfNote,
  };
}

export function pickBest(results: SetupOut[]): SetupOut | null {
  const tradable = results.filter((r) => r.grade !== 'no-trade');
  if (!tradable.length) return null;
  const rank: Record<Exclude<SetupGrade, 'no-trade'>, number> = { A: 3, B: 2, C: 1 };
  return [...tradable].sort((a, b) =>
    rank[b.grade as 'A' | 'B' | 'C'] - rank[a.grade as 'A' | 'B' | 'C']
    || b.rr1 - a.rr1
    || a.spreadPct - b.spreadPct
    || b.coveragePct - a.coveragePct,
  )[0];
}

/** Aliases used to match SoSoValue headlines to a pair's base asset. */
export function assetAliases(base: string): string[] {
  const raw = base.replace(/^v/i, '').replace(/^W/i, '');
  const key = raw.toUpperCase();
  const extra: Record<string, string[]> = {
    BTC: ['btc', 'bitcoin'],
    ETH: ['eth', 'ethereum', 'ether'],
    SOL: ['sol', 'solana'],
    AVAX: ['avax', 'avalanche'],
    LINK: ['link', 'chainlink'],
    SOSO: ['soso', 'sosovalue', 'wsoso'],
    HYPE: ['hype', 'hyperliquid'],
  };
  const more = extra[key] ?? extra[base.replace(/^v/i, '').toUpperCase()] ?? [key.toLowerCase()];
  return [...new Set([key.toLowerCase(), raw.toLowerCase(), base.toLowerCase(), ...more])].filter((s) => s.length >= 3 || s === 'eth' || s === 'btc' || s === 'sol');
}

export function etfAssetFor(base: string): 'BTC' | 'ETH' | null {
  const k = base.replace(/^v/i, '').replace(/^W/i, '').toUpperCase();
  if (k === 'BTC' || k === 'WBTC' || k === 'CBBTC') return 'BTC';
  if (k === 'ETH' || k === 'WETH' || k === 'STETH') return 'ETH';
  return null;
}
