/**
 * Chart Scanner — adapted from day-trader-skill trader-scanner (MIT).
 * Setups on closes: breakout_20d, bull_flag, reclaim_ma20, oversold, oversold_bounce.
 * ORB: first completed bar after opening-range that closes beyond range high/low.
 */

export type SetupTag =
  | "breakout_20d"
  | "bull_flag"
  | "reclaim_ma20"
  | "oversold"
  | "oversold_bounce"
  | "orb_long"
  | "orb_short";

export const SETUP_LABELS: Record<SetupTag, string> = {
  breakout_20d: "20-bar closing-high breakout",
  bull_flag: "bull flag",
  reclaim_ma20: "reclaimed the 20-bar average",
  oversold: "oversold (RSI under 30)",
  oversold_bounce: "oversold bounce",
  orb_long: "opening-range breakout (long)",
  orb_short: "opening-range breakdown (short)",
};

/** Wilder RSI — same math as day-trader-skill scan.py */
export function wilderRsi(closes: number[], n = 14): number | null {
  if (closes.length < n + 1) return null;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    gains.push(Math.max(0, d));
    losses.push(Math.max(0, -d));
  }
  let ag = gains.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let al = losses.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < gains.length; i++) {
    ag = (ag * (n - 1) + gains[i]!) / n;
    al = (al * (n - 1) + losses[i]!) / n;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

export function findDailySetups(closes: number[]): {
  setups: SetupTag[];
  nums: {
    rsi: number | null;
    rsiPrev: number | null;
    high20: number;
    ma20: number;
    runPct: number;
    range5Pct: number;
  };
} {
  if (closes.length < 30) {
    return {
      setups: [],
      nums: { rsi: null, rsiPrev: null, high20: 0, ma20: 0, runPct: 0, range5Pct: 0 },
    };
  }
  const c = closes;
  const last = c[c.length - 1]!;
  const hi20 = Math.max(...c.slice(-21, -1));
  const ma20 = c.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const ma20Prev = c.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const run = c[c.length - 6]! / c[c.length - 16]! - 1;
  const last5 = c.slice(-5);
  const rng5 = (Math.max(...last5) - Math.min(...last5)) / last;
  const r = wilderRsi(c);
  const rPrev = wilderRsi(c.slice(0, -1));
  const tags: SetupTag[] = [];
  if (last > hi20) tags.push("breakout_20d");
  if (run > 0.1 && rng5 < 0.05) tags.push("bull_flag");
  if (c[c.length - 2]! < ma20Prev && last > ma20) tags.push("reclaim_ma20");
  if (r != null && r < 30) tags.push("oversold");
  if (rPrev != null && rPrev < 30 && last > c[c.length - 2]!) tags.push("oversold_bounce");
  return {
    setups: tags,
    nums: {
      rsi: r,
      rsiPrev: rPrev,
      high20: hi20,
      ma20,
      runPct: run * 100,
      range5Pct: rng5 * 100,
    },
  };
}

export type Bar = { t: number; o: number; h: number; l: number; c: number; v?: number };

/** Opening-range breakout on intraday bars (crypto: first orBars of the UTC day). */
export function detectOrb(opts: {
  bars: Bar[];
  orBars: number;
  side?: "long" | "short" | "both";
}): {
  triggered: boolean;
  side: "long" | "short" | null;
  rangeHigh: number;
  rangeLow: number;
  entryBarIndex: number | null;
  entryPrice: number | null;
  entryTime: number | null;
} {
  const { bars, orBars } = opts;
  const sideWant = opts.side ?? "both";
  if (bars.length <= orBars) {
    return {
      triggered: false,
      side: null,
      rangeHigh: 0,
      rangeLow: 0,
      entryBarIndex: null,
      entryPrice: null,
      entryTime: null,
    };
  }
  const range = bars.slice(0, orBars);
  const rangeHigh = Math.max(...range.map((b) => b.h));
  const rangeLow = Math.min(...range.map((b) => b.l));
  for (let i = orBars; i < bars.length; i++) {
    const b = bars[i]!;
    if ((sideWant === "long" || sideWant === "both") && b.c > rangeHigh) {
      return {
        triggered: true,
        side: "long",
        rangeHigh,
        rangeLow,
        entryBarIndex: i,
        entryPrice: b.c,
        entryTime: b.t,
      };
    }
    if ((sideWant === "short" || sideWant === "both") && b.c < rangeLow) {
      return {
        triggered: true,
        side: "short",
        rangeHigh,
        rangeLow,
        entryBarIndex: i,
        entryPrice: b.c,
        entryTime: b.t,
      };
    }
  }
  return {
    triggered: false,
    side: null,
    rangeHigh,
    rangeLow,
    entryBarIndex: null,
    entryPrice: null,
    entryTime: null,
  };
}
