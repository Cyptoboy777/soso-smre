/**
 * Exit Planner — adapted from day-trader-skill trader-exit (MIT).
 * Sets stop + target before entry. A stop is a plan, not a guarantee.
 */

export type ExitPlan = {
  side: "buy" | "sell";
  entry: number;
  stop: number;
  target: number;
  risk: number;
  rewardRisk: number;
  stopRule: string;
  targetRule: string;
  note: string;
};

function roundAway(x: number, long: boolean): number {
  const c = Math.round(x * 10000) / 100;
  // stop away from entry: floor for long, ceil for short (to the cent)
  const cents = x * 100;
  return (long ? Math.floor(cents) : Math.ceil(cents)) / 100;
}

function roundHalfUp(x: number): number {
  return Math.round(x * 100) / 100;
}

export function planExit(opts: {
  side: "buy" | "sell";
  entry: number;
  /** Opening-range mid stop (default for ORB). */
  rangeHigh?: number;
  rangeLow?: number;
  stopRule?: "or-mid" | "or-low" | "or-high" | "pct";
  stopPct?: number;
  targetR?: number;
}): ExitPlan {
  const long = opts.side === "buy";
  const entry = opts.entry;
  const stopRule = opts.stopRule ?? "or-mid";
  const targetR = opts.targetR ?? 1;
  let stop: number;
  if (stopRule === "pct") {
    const pct = (opts.stopPct ?? 1) / 100;
    stop = roundAway(long ? entry * (1 - pct) : entry * (1 + pct), long);
  } else if (stopRule === "or-low" || (!long && stopRule === "or-high")) {
    if (opts.rangeLow == null) throw new Error("or-low stop needs rangeLow");
    stop = roundAway(opts.rangeLow, long);
  } else if (stopRule === "or-high") {
    if (opts.rangeHigh == null) throw new Error("or-high stop needs rangeHigh");
    stop = roundAway(opts.rangeHigh, long);
  } else {
    // or-mid
    if (opts.rangeHigh == null || opts.rangeLow == null) {
      throw new Error("or-mid stop needs rangeHigh and rangeLow");
    }
    stop = roundAway((opts.rangeHigh + opts.rangeLow) / 2, long);
  }
  const risk = long ? entry - stop : stop - entry;
  if (!(risk > 0)) throw new Error("stop must leave positive risk vs entry");
  if (risk / entry < 0.0005) {
    throw new Error("risk under 0.05% of price — too tight for spreads");
  }
  const target = roundHalfUp(long ? entry + targetR * risk : entry - targetR * risk);
  if (long && !(stop < entry && entry < target)) {
    throw new Error("buy needs stop < entry < target");
  }
  if (!long && !(target < entry && entry < stop)) {
    throw new Error("sell needs target < entry < stop");
  }
  return {
    side: opts.side,
    entry: roundHalfUp(entry),
    stop,
    target,
    risk: roundHalfUp(risk),
    rewardRisk: Math.round((targetR + Number.EPSILON) * 100) / 100,
    stopRule,
    targetRule: `${targetR}R`,
    note: "A stop is a plan, not a guarantee: a gap or a fast market can fill past it. Adapted from day-trader-skill (MIT).",
  };
}
