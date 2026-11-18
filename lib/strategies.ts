/**
 * Strategy library: pure simulations for DCA and grid on past candles, and a TWAP slice planner.
 * Same honesty rules as backtest.ts: real candles, real fees, stated assumptions, no forecasts.
 */

import type { Candle } from './setup';

export type SimOut = {
  kind: 'dca' | 'grid';
  net: number; netPct: number; invested: number; endValue: number; maxDrawdownPct: number;
  buyHoldPct: number; feesPaid: number; trades: number; notes: string[]; assumptions: string[];
  curve: { t: number; eq: number }[];
};

const clean = (c: Candle[]) => [...c].filter((x) => x && x.o > 0 && x.h > 0 && x.l > 0 && x.c > 0).sort((a, b) => a.t - b.t);

/* ───────── DCA ───────── */

export type DcaParams = { candles: Candle[]; amountUsd: number; everyBars: number; takerFee: number; builderFeePct?: number; spreadPct: number };

export function simulateDca(p: DcaParams): SimOut | null {
  const c = clean(p.candles);
  if (c.length < 2 || !(p.amountUsd > 0) || !(p.everyBars >= 1)) return null;
  const half = p.spreadPct / 200;
  const feeSide = p.takerFee + (p.builderFeePct ?? 0) / 100;
  let units = 0, spent = 0, fees = 0, buys = 0, peak = 0, dd = 0;
  const curve: { t: number; eq: number }[] = [];
  for (let i = 0; i < c.length; i++) {
    if (i % Math.floor(p.everyBars) === 0 && i < c.length - 1) {
      const px = c[i].o * (1 + half);
      const fee = p.amountUsd * feeSide;
      units += (p.amountUsd - fee) / px; spent += p.amountUsd; fees += fee; buys++;
    }
    const value = units * c[i].c * (1 - half);
    if (spent > 0) { peak = Math.max(peak, value / spent); dd = Math.max(dd, peak > 0 ? (1 - value / spent / peak) * 100 : 0); }
    curve.push({ t: c[i].t, eq: value });
  }
  const end = units * c[c.length - 1].c * (1 - half);
  const lump = spent > 0 ? (c[c.length - 1].c / c[0].o - 1) * 100 : 0;
  return {
    kind: 'dca', net: end - spent, netPct: spent > 0 ? ((end - spent) / spent) * 100 : 0, invested: spent, endValue: end,
    maxDrawdownPct: dd, buyHoldPct: lump, feesPaid: fees, trades: buys,
    notes: [`${buys} buys of $${p.amountUsd} every ${Math.floor(p.everyBars)} candles.`, `Average cost per unit: ${units > 0 ? (spent / units).toPrecision(6) : 'n/a'}.`],
    assumptions: ['Each buy fills at the candle open plus half the assumed spread, with the real taker and SoSwapDEX fee.', 'The end value is marked at the last close minus half the spread.', 'Buy-and-hold compares one lump buy at the first open to the last close.', 'Past results do not predict future ones.'],
    curve,
  };
}

/* ───────── Grid ───────── */

export type GridParams = { candles: Candle[]; lower: number; upper: number; levels: number; budgetUsd: number; makerFee: number; builderFeePct?: number };

/** Arithmetic grid levels, lowest first, `levels` lines (so levels-1 cells). */
export function gridLevels(lower: number, upper: number, levels: number): number[] {
  if (!(lower > 0) || !(upper > lower) || !(levels >= 2)) return [];
  const n = Math.min(Math.floor(levels), 200);
  const step = (upper - lower) / (n - 1);
  return Array.from({ length: n }, (_, i) => lower + step * i);
}

/** Smallest step between two grid lines as a percent of price; must beat the round-trip fee or the grid loses money on every cycle. */
export function gridCellPct(lower: number, upper: number, levels: number): number {
  const lv = gridLevels(lower, upper, levels);
  return lv.length > 1 ? ((lv[1] - lv[0]) / lv[0]) * 100 : 0;
}

export function simulateGrid(p: GridParams): SimOut | null {
  const c = clean(p.candles);
  const lv = gridLevels(p.lower, p.upper, p.levels);
  if (c.length < 2 || lv.length < 2 || !(p.budgetUsd > 0)) return null;
  const cells = lv.length - 1;
  const perCell = p.budgetUsd / cells;                 // quote money assigned to each cell
  const feeSide = p.makerFee + (p.builderFeePct ?? 0) / 100;
  // Each cell is either waiting to buy at its lower line or holding base waiting to sell at its upper line.
  // The grid starts with cash only, so no inventory is invented: every cell waits to buy.
  const holding: boolean[] = new Array(cells).fill(false);
  let cash = p.budgetUsd, fees = 0, rt = 0, trades = 0, peak = p.budgetUsd, dd = 0, realised = 0;
  const base: number[] = new Array(cells).fill(0);
  const curve: { t: number; eq: number }[] = [];
  const value = (px: number) => cash + base.reduce((s, q) => s + q * px, 0);

  const touch = (from: number, to: number) => {
    // walk the move from -> to and trigger every grid line it crosses, in order
    if (from === to) return;
    if (to < from) {
      for (let k = cells - 1; k >= 0; k--) {
        const buy = lv[k];
        if (!holding[k] && from > buy && to <= buy && cash >= perCell) {
          const qty = (perCell * (1 - feeSide)) / buy; fees += perCell * feeSide; cash -= perCell; base[k] = qty; holding[k] = true; trades++;
        }
      }
    } else {
      for (let k = 0; k < cells; k++) {
        const sell = lv[k + 1];
        if (holding[k] && from < sell && to >= sell) {
          const gross = base[k] * sell; const fee = gross * feeSide; cash += gross - fee; fees += fee; realised += gross - fee - perCell; base[k] = 0; holding[k] = false; rt++; trades++;
        }
      }
    }
  };

  for (const k of c) {
    const path = k.c >= k.o ? [k.o, k.l, k.h, k.c] : [k.o, k.h, k.l, k.c]; // O-L-H-C on up bars, O-H-L-C on down bars
    for (let i = 0; i < path.length - 1; i++) touch(path[i], path[i + 1]);
    const eq = value(k.c);
    peak = Math.max(peak, eq); dd = Math.max(dd, peak > 0 ? ((peak - eq) / peak) * 100 : 0);
    curve.push({ t: k.t, eq });
  }
  const last = c[c.length - 1].c;
  const end = value(last);
  const held = holding.filter(Boolean).length;
  const notes = [`${rt} completed buy-then-sell cycles, ${held} cell${held === 1 ? '' : 's'} still holding at the end.`];
  if (last < p.lower) notes.push('Price ended below the grid. Inventory is held at a loss until price returns.');
  if (last > p.upper) notes.push('Price ended above the grid. The grid sold out and sat in cash while price kept rising.');
  const cellPct = gridCellPct(p.lower, p.upper, p.levels);
  if (cellPct < feeSide * 2 * 100 * 1.5) notes.push(`Each grid step is ${cellPct.toFixed(2)}% wide, which is too thin against the ${(feeSide * 200).toFixed(2)}% round-trip fee.`);
  return {
    kind: 'grid', net: end - p.budgetUsd, netPct: ((end - p.budgetUsd) / p.budgetUsd) * 100, invested: p.budgetUsd, endValue: end,
    maxDrawdownPct: dd, buyHoldPct: (last / c[0].o - 1) * 100, feesPaid: fees, trades, notes,
    assumptions: ['Orders fill as limit orders when a candle trades through the line, at the line price, with the maker fee.', 'Inside one candle the price path is assumed Open-Low-High-Close on up bars and Open-High-Low-Close on down bars.', 'The grid starts with cash only: each cell buys when price falls to its lower line and sells at its upper line.', 'Open inventory is marked at the last close.', 'Past results do not predict future ones.'],
    curve,
  };
}

/* ───────── TWAP planner ───────── */

export type TwapPlan = { slices: number; sliceUsd: number; everyMin: number; ok: boolean; problems: string[] };

/** Splits one order into equal slices. No simulation: it only checks the plan against the market's own minimums. */
export function planTwap(totalUsd: number, hours: number, slices: number, minNotional: number): TwapPlan {
  const problems: string[] = [];
  const n = Math.max(1, Math.floor(slices));
  if (!(totalUsd > 0)) problems.push('Enter a total amount.');
  if (!(hours > 0)) problems.push('Enter how many hours to spread it over.');
  const sliceUsd = totalUsd > 0 ? totalUsd / n : 0;
  if (sliceUsd > 0 && minNotional > 0 && sliceUsd < minNotional) problems.push(`Each slice would be $${sliceUsd.toFixed(2)}, below this market's $${minNotional} minimum. Use fewer slices.`);
  if (n > 200) problems.push('At most 200 slices.');
  return { slices: n, sliceUsd, everyMin: hours > 0 ? (hours * 60) / n : 0, ok: problems.length === 0, problems };
}
