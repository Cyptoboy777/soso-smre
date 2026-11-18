/**
 * Backtest of the AI Setup engine on past candles. Pure functions, no network, no AI.
 *
 * What is real: the candles, and the exact same computeSetup() rules that the live builder uses.
 * What is assumed: candles carry no order book, so each signal gets a synthetic book with the spread you pass in,
 * and every fill pays an extra slippage charge. Fees are the real taker and builder fees, both ways.
 * A bar that touches both stop and target is counted as a stop (the pessimistic reading).
 * The result is a look at the past, never a forecast.
 */

import { computeSetup, type Candle, type SetupGrade } from './setup';

export type BtParams = {
  pair: string; display: string; base: string;
  candles: Candle[];
  takerFee: number;          // fraction, e.g. 0.00065
  builderFeePct?: number;    // percent per side
  spreadPct: number;         // assumed full spread in percent
  slipPct?: number;          // extra slippage per side in percent (default 0.05)
  equity: number;
  riskPct: number;
  minGrade?: 'A' | 'B' | 'C';
  maxHoldBars?: number;      // default 48
  minNotional?: number;
  interval?: string;
};

export type BtTrade = {
  entryIdx: number; exitIdx: number; entryTime: number; exitTime: number;
  entry: number; exit: number; qty: number; grade: SetupGrade;
  reason: 'target' | 'stop' | 'timeout' | 'end';
  pnl: number; pnlPct: number; r: number; fees: number;
};

export type BtStats = {
  bars: number; signals: number; trades: number; wins: number; losses: number; winRate: number;
  net: number; netPct: number; profitFactor: number | null; avgR: number; maxDrawdownPct: number;
  buyHoldPct: number; feesPaid: number; startEquity: number; endEquity: number;
};

export type BtResult = {
  trades: BtTrade[]; stats: BtStats;
  curve: { t: number; eq: number }[];
  from: number; to: number; assumptions: string[]; enough: boolean;
};

const GRADE_RANK: Record<SetupGrade, number> = { A: 3, B: 2, C: 1, 'no-trade': 0 };
export const WARMUP = 60;
export const MIN_TRADES_FOR_CONFIDENCE = 20;

/** A deep, symmetrical book around `price`. Depth is not the question here, spread is. */
export function syntheticBook(price: number, spreadPct: number) {
  const half = (spreadPct / 100) / 2;
  const bid = price * (1 - half), ask = price * (1 + half);
  const deep = 1e12 / Math.max(price, 1e-12);
  return { bids: [{ price: bid, size: deep }], asks: [{ price: ask, size: deep }] };
}

export function assumptionsFor(p: Pick<BtParams, 'spreadPct' | 'slipPct' | 'takerFee' | 'builderFeePct' | 'maxHoldBars'>): string[] {
  const slip = p.slipPct ?? 0.05;
  return [
    'Candles have no order book, so a spread of ' + p.spreadPct.toFixed(2) + '% and ' + slip.toFixed(2) + '% slippage per side are assumed.',
    'Fees are the real taker fee (' + (p.takerFee * 100).toFixed(3) + '%) plus the SoSwapDEX fee (' + (p.builderFeePct ?? 0).toFixed(3) + '%), charged on entry and exit.',
    'Entries fill at the next candle open. Exits are the first target, the stop, or after ' + (p.maxHoldBars ?? 48) + ' candles.',
    'If one candle touches both the stop and the target, it is counted as a stop.',
    'Past results do not predict future ones.',
  ];
}

export function runBacktest(p: BtParams): BtResult {
  const candles = [...p.candles].filter((c) => c && c.c > 0 && c.h > 0 && c.l > 0 && c.o > 0).sort((a, b) => a.t - b.t);
  const slip = (p.slipPct ?? 0.05) / 100;
  const half = p.spreadPct / 100 / 2;
  const feeSide = p.takerFee + (p.builderFeePct ?? 0) / 100;
  const maxHold = p.maxHoldBars ?? 48;
  const minRank = GRADE_RANK[p.minGrade ?? 'B'];
  const trades: BtTrade[] = [];
  const curve: { t: number; eq: number }[] = [];
  let eq = p.equity, peak = eq, maxDd = 0, signals = 0, feesPaid = 0;
  const assumptions = assumptionsFor(p);
  const from = candles[0]?.t ?? 0, to = candles[candles.length - 1]?.t ?? 0;
  if (candles.length > 0) curve.push({ t: from, eq });

  let i = WARMUP;
  while (i < candles.length - 1) {
    const window = candles.slice(0, i + 1);
    const close = window[window.length - 1].c;
    const book = syntheticBook(close, p.spreadPct);
    const s = computeSetup({
      pair: p.pair, display: p.display, base: p.base, candles: window, bids: book.bids, asks: book.asks, last: close, quoteVol: 1e12,
      takerFee: p.takerFee, halted: false, minNotional: p.minNotional, equity: eq, riskPct: p.riskPct, interval: p.interval, builderFeePct: p.builderFeePct,
    });
    if (GRADE_RANK[s.grade] < minRank || !(s.qty > 0) || !(s.stop > 0) || !(s.tp1 > 0)) { i++; continue; }
    signals++;

    const e = candles[i + 1];
    const entry = e.o * (1 + half + slip);
    if (entry <= s.stop || entry >= s.tp1 || entry * s.qty > eq) { i++; continue; } // gapped through the plan or cannot afford it
    const qty = s.qty;
    const entryFee = entry * qty * feeSide;

    let exitIdx = -1, exit = 0, reason: BtTrade['reason'] = 'timeout';
    const last = Math.min(candles.length - 1, i + 1 + maxHold);
    for (let j = i + 1; j <= last; j++) {
      const c = candles[j];
      const hitStop = c.l <= s.stop;
      const hitTarget = c.h >= s.tp1; // limit-style fill needs the print to reach the target
      if (hitStop) { exitIdx = j; exit = Math.min(s.stop, c.o) * (1 - half - slip); reason = 'stop'; break; }
      if (hitTarget) { exitIdx = j; exit = s.tp1 * (1 - half); reason = 'target'; break; }
      if (j === last) { exitIdx = j; exit = c.c * (1 - half - slip); reason = j === candles.length - 1 && j < i + 1 + maxHold ? 'end' : 'timeout'; }
    }
    if (exitIdx < 0) break;
    const exitFee = exit * qty * feeSide;
    const fees = entryFee + exitFee;
    const gross = (exit - entry) * qty;
    const pnl = gross - fees;
    const risk = Math.max((entry - s.stop) * qty + entry * qty * feeSide * 2, 1e-12);
    eq += pnl; feesPaid += fees;
    peak = Math.max(peak, eq); maxDd = Math.max(maxDd, peak > 0 ? ((peak - eq) / peak) * 100 : 0);
    trades.push({ entryIdx: i + 1, exitIdx, entryTime: e.t, exitTime: candles[exitIdx].t, entry, exit, qty, grade: s.grade, reason, pnl, pnlPct: (pnl / (entry * qty)) * 100, r: pnl / risk, fees });
    curve.push({ t: candles[exitIdx].t, eq });
    i = exitIdx + 1;
  }

  const wins = trades.filter((t) => t.pnl > 0), losses = trades.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0), grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const start = candles[Math.min(WARMUP, candles.length - 1)]?.c ?? 0, endPx = candles[candles.length - 1]?.c ?? 0;
  const stats: BtStats = {
    bars: candles.length, signals, trades: trades.length, wins: wins.length, losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    net: eq - p.equity, netPct: p.equity > 0 ? ((eq - p.equity) / p.equity) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgR: trades.length ? trades.reduce((s, t) => s + t.r, 0) / trades.length : 0,
    maxDrawdownPct: maxDd, buyHoldPct: start > 0 ? ((endPx - start) / start) * 100 : 0,
    feesPaid, startEquity: p.equity, endEquity: eq,
  };
  return { trades, stats, curve, from, to, assumptions, enough: trades.length >= MIN_TRADES_FOR_CONFIDENCE };
}
