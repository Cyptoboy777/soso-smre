/**
 * Time Machine — adapted from day-trader-skill trader-timemachine (MIT).
 * 10,000 Monte Carlo replays from the asset's own recent bars (time-of-day
 * conditioned), plus historical rule replays. Labelled simulation, not a prediction.
 */
import { SeededRng } from "@/lib/day-trader/rng";
import type { Bar } from "@/lib/day-trader/scanner";

/** Crypto: UTC day = 288 five-minute bars. */
export const CRYPTO_SESSION_BARS = 288;
export const OPEN_SLOT = 0;

export type SessionDay = { date: string; bars: Bar[] };

export type MonteCarloResult = {
  replays: number;
  seed: number;
  window: number;
  barsLeft: number;
  pTarget: number;
  pStop: number;
  pNeither: number;
  pGreen: number;
  medianClose: number;
  p5Close: number;
  p95Close: number;
  avgR: number;
  rAtTarget: number;
  verdict: string;
  notes: string[];
  disclaimer: string;
};

export type HistoryReplay = {
  sessions: number;
  triggered: number;
  target: number;
  stop: number;
  neither: number;
  avgR: number | null;
};

function pct(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Group 5m bars into UTC calendar days; keep only complete sessions. */
export function splitUtcSessions(
  bars: Bar[],
  sessionBars = CRYPTO_SESSION_BARS,
): SessionDay[] {
  const byDay = new Map<string, Bar[]>();
  for (const b of bars) {
    const d = utcDateKey(b.t);
    const list = byDay.get(d) ?? [];
    list.push(b);
    byDay.set(d, list);
  }
  const out: SessionDay[] = [];
  for (const [date, list] of [...byDay.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const sorted = list.sort((a, b) => a.t - b.t);
    // Accept near-complete days (≥ 90% of slots) for crypto partial coverage
    if (sorted.length >= Math.floor(sessionBars * 0.9)) {
      out.push({ date, bars: sorted.slice(0, sessionBars) });
    }
  }
  return out;
}

export function buildPool(sessions: SessionDay[]): Array<Array<[number, number, number, number]>> {
  const n = Math.max(...sessions.map((s) => s.bars.length), 1);
  const pool: Array<Array<[number, number, number, number]>> = Array.from(
    { length: n },
    () => [],
  );
  for (const { bars } of sessions) {
    for (let i = 1; i < bars.length; i++) {
      const pc = bars[i - 1]!.c;
      if (!(pc > 0)) continue;
      const b = bars[i]!;
      pool[i]!.push([b.o / pc, b.h / pc, b.l / pc, b.c / pc]);
    }
  }
  return pool;
}

export function runMonteCarlo(opts: {
  pool: Array<Array<[number, number, number, number]>>;
  entry: number;
  stop: number;
  target: number;
  entryBarIndex: number;
  lastBarIndex: number;
  side: "buy" | "sell";
  replays?: number;
  seed?: number;
  window?: number;
}): MonteCarloResult {
  const replays = opts.replays ?? 10_000;
  const seed = opts.seed ?? 19;
  const window = opts.window ?? 2;
  const long = opts.side === "buy";
  const risk = long ? opts.entry - opts.stop : opts.stop - opts.entry;
  const rTarget =
    Math.round(
      (((long ? opts.target - opts.entry : opts.entry - opts.target) / risk) +
        Number.EPSILON) *
        1e4,
    ) / 1e4;
  const sessionBars = opts.pool.length;

  const slot = (rng: SeededRng, i: number) => {
    if (window === 0) return i;
    return Math.min(
      sessionBars - 1,
      Math.max(1, i + rng.randint(-window, window)),
    );
  };

  const rng = new SeededRng(seed);
  const outcomes: Array<"target" | "stop" | "close"> = [];
  const closes: number[] = [];
  const Rs: number[] = [];

  for (let n = 0; n < replays; n++) {
    let p = opts.entry;
    let outcome: "target" | "stop" | "close" | null = null;
    for (let i = opts.entryBarIndex + 1; i <= opts.lastBarIndex; i++) {
      const bucket = opts.pool[slot(rng, i)] ?? [];
      if (!bucket.length) continue;
      const [, h, l, c] = rng.choice(bucket);
      const hi = p * h;
      const lo = p * l;
      const cl = p * c;
      if (outcome == null) {
        if (long) {
          if (lo <= opts.stop) outcome = "stop";
          else if (hi >= opts.target) outcome = "target";
        } else {
          if (hi >= opts.stop) outcome = "stop";
          else if (lo <= opts.target) outcome = "target";
        }
      }
      p = cl;
    }
    const o = outcome ?? "close";
    outcomes.push(o);
    closes.push(p);
    Rs.push(
      o === "target"
        ? rTarget
        : o === "stop"
          ? -1
          : (long ? p - opts.entry : opts.entry - p) / risk,
    );
  }

  const cnt = {
    target: outcomes.filter((x) => x === "target").length,
    stop: outcomes.filter((x) => x === "stop").length,
    close: outcomes.filter((x) => x === "close").length,
  };
  const green = outcomes.filter((o, i) => {
    if (o === "target") return true;
    if (o === "close") {
      const p = closes[i]!;
      return long ? p > opts.entry : p < opts.entry;
    }
    return false;
  }).length;

  const srt = [...closes].sort((a, b) => a - b);
  const avgR = Rs.reduce((a, b) => a + b, 0) / Rs.length;
  const pTarget = cnt.target / replays;
  const pStop = cnt.stop / replays;
  const pNeither = cnt.close / replays;

  const hit = cnt.target + cnt.stop;
  const targetShare = hit > 0 ? cnt.target / hit : 0.5;
  const beShare = 1 / (1 + rTarget);
  const gap = targetShare - beShare;
  let verdict: string;
  const abs = Math.abs(gap);
  if (abs < 0.05) {
    verdict =
      Math.abs(rTarget - 1) < 0.05
        ? "Close to a coin flip"
        : "Close to break-even";
  } else if (abs < 0.15) {
    verdict = gap > 0 ? "Leans toward the target" : "Leans toward the stop";
  } else {
    verdict =
      gap > 0 ? "Strongly toward the target" : "Strongly toward the stop";
  }

  const notes: string[] = [];
  if (pNeither > 0.4) {
    notes.push(
      "More than 40% of replays hit neither side before the flat-by bar — price at session end decides those.",
    );
  }
  if ((gap > 0 && avgR < 0) || (gap < 0 && avgR > 0)) {
    notes.push(
      `Average R (${avgR.toFixed(3)}) goes against the lean — treat the verdict cautiously.`,
    );
  }

  return {
    replays,
    seed,
    window,
    barsLeft: opts.lastBarIndex - opts.entryBarIndex,
    pTarget: Math.round(pTarget * 1e4) / 1e4,
    pStop: Math.round(pStop * 1e4) / 1e4,
    pNeither: Math.round(pNeither * 1e4) / 1e4,
    pGreen: Math.round((green / replays) * 1e4) / 1e4,
    medianClose: Math.round(pct(srt, 0.5) * 100) / 100,
    p5Close: Math.round(pct(srt, 0.05) * 100) / 100,
    p95Close: Math.round(pct(srt, 0.95) * 100) / 100,
    avgR: Math.round(avgR * 1e3) / 1e3,
    rAtTarget: rTarget,
    verdict,
    notes,
    disclaimer:
      "SIMULATION, not a prediction. Built from this asset's own recent SoDEX bars conditioned on time-of-day. News, halts and regime shifts can do what the sample never did. Adapted from day-trader-skill Time Machine (MIT).",
  };
}

/** Historical ORB rule replay on past UTC sessions. */
export function historyOrbReplay(opts: {
  sessions: SessionDay[];
  orBars: number;
  targetR: number;
  stopRule: "or-mid" | "or-low";
  side: "buy" | "sell";
  lastBarIndex: number;
}): HistoryReplay {
  const long = opts.side === "buy";
  const trades: number[] = [];
  let target = 0;
  let stop = 0;
  let neither = 0;
  for (const { bars } of opts.sessions) {
    if (bars.length <= opts.orBars + 1) continue;
    const range = bars.slice(0, opts.orBars);
    const oh = Math.max(...range.map((b) => b.h));
    const ol = Math.min(...range.map((b) => b.l));
    let kk: number | null = null;
    for (let i = opts.orBars; i <= opts.lastBarIndex && i < bars.length; i++) {
      const c = bars[i]!.c;
      if (long ? c > oh : c < ol) {
        kk = i;
        break;
      }
    }
    if (kk == null) continue;
    const e = bars[kk]!.c;
    const s =
      opts.stopRule === "or-mid"
        ? (oh + ol) / 2
        : long
          ? ol
          : oh;
    const risk = long ? e - s : s - e;
    if (!(risk > 0)) continue;
    const t = long ? e + opts.targetR * risk : e - opts.targetR * risk;
    let oc: "target" | "stop" | "close" | null = null;
    for (let i = kk + 1; i <= opts.lastBarIndex && i < bars.length; i++) {
      const b = bars[i]!;
      if (long) {
        if (b.l <= s) {
          oc = "stop";
          break;
        }
        if (b.h >= t) {
          oc = "target";
          break;
        }
      } else {
        if (b.h >= s) {
          oc = "stop";
          break;
        }
        if (b.l <= t) {
          oc = "target";
          break;
        }
      }
    }
    const cl = bars[Math.min(opts.lastBarIndex, bars.length - 1)]!.c;
    const R =
      oc === "target"
        ? opts.targetR
        : oc === "stop"
          ? -1
          : (long ? cl - e : e - cl) / risk;
    trades.push(R);
    if (oc === "target") target++;
    else if (oc === "stop") stop++;
    else neither++;
  }
  return {
    sessions: opts.sessions.length,
    triggered: trades.length,
    target,
    stop,
    neither,
    avgR:
      trades.length > 0
        ? Math.round(
            (trades.reduce((a, b) => a + b, 0) / trades.length) * 1e3,
          ) / 1e3
        : null,
  };
}
