/**
 * Derive and validate entry / stop / target so the UI never shows
 * identical fake levels for a directional trade.
 */

export type TradeSide = "LONG" | "SHORT" | "FLAT";

export type TradeLevels = {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  /** False when there is no valid directional setup to show. */
  hasSetup: boolean;
  reason?: string;
};

const DEFAULT_ATR_FRAC = 0.012; // ~1.2% proxy when no ATR feed

function roundPx(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1000) return Number(n.toFixed(2));
  if (n >= 1) return Number(n.toFixed(4));
  return Number(n.toPrecision(6));
}

/** Direction-aware stops/targets from entry using an ATR-like fraction of price. */
export function deriveTradeLevels(
  side: TradeSide,
  entryRaw: number,
  atrFrac = DEFAULT_ATR_FRAC,
): TradeLevels {
  const entry = roundPx(entryRaw);
  if (!Number.isFinite(entry) || entry <= 0) {
    return {
      entry: 0,
      stopLoss: 0,
      takeProfit: 0,
      hasSetup: false,
      reason: "No market price available",
    };
  }
  if (side === "FLAT") {
    return {
      entry,
      stopLoss: entry,
      takeProfit: entry,
      hasSetup: false,
      reason: "No trade setup",
    };
  }

  const atr = Math.max(entry * Math.max(0.004, Math.min(0.05, atrFrac)), entry * 0.004);
  const stopDist = atr * 1.5;
  const targetDist = atr * 2.5;

  if (side === "LONG") {
    const stopLoss = roundPx(entry - stopDist);
    const takeProfit = roundPx(entry + targetDist);
    return finalize(side, entry, stopLoss, takeProfit);
  }

  const stopLoss = roundPx(entry + stopDist);
  const takeProfit = roundPx(entry - targetDist);
  return finalize(side, entry, stopLoss, takeProfit);
}

function finalize(
  side: TradeSide,
  entry: number,
  stopLoss: number,
  takeProfit: number,
): TradeLevels {
  if (!hasValidTradeSetup(side, entry, stopLoss, takeProfit)) {
    // Rebuild from entry if model returned garbage
    return deriveTradeLevels(side, entry);
  }
  return { entry, stopLoss, takeProfit, hasSetup: true };
}

/**
 * True only when levels are distinct and correctly ordered for the side.
 */
export function hasValidTradeSetup(
  side: TradeSide,
  entry: number,
  stopLoss: number,
  takeProfit: number,
): boolean {
  if (side === "FLAT") return false;
  if (![entry, stopLoss, takeProfit].every((n) => Number.isFinite(n) && n > 0)) {
    return false;
  }
  const eps = Math.max(entry * 1e-6, 1e-8);
  if (Math.abs(entry - stopLoss) < eps || Math.abs(entry - takeProfit) < eps) {
    return false;
  }
  if (Math.abs(stopLoss - takeProfit) < eps) return false;
  if (side === "LONG") {
    return stopLoss < entry && takeProfit > entry;
  }
  return stopLoss > entry && takeProfit < entry;
}

/**
 * Normalize model/rules output. If invalid for a directional side, re-derive.
 * FLAT always returns hasSetup false.
 */
export function normalizeTradeLevels(opts: {
  side: TradeSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  atrFrac?: number;
}): TradeLevels {
  const { side, atrFrac } = opts;
  const entry = roundPx(opts.entry);
  const stopLoss = roundPx(opts.stopLoss);
  const takeProfit = roundPx(opts.takeProfit);

  if (side === "FLAT") {
    return {
      entry,
      stopLoss: entry,
      takeProfit: entry,
      hasSetup: false,
      reason: "No trade setup",
    };
  }

  if (hasValidTradeSetup(side, entry, stopLoss, takeProfit)) {
    return { entry, stopLoss, takeProfit, hasSetup: true };
  }

  if (entry > 0) {
    return deriveTradeLevels(side, entry, atrFrac);
  }

  return {
    entry: 0,
    stopLoss: 0,
    takeProfit: 0,
    hasSetup: false,
    reason: "No trade setup",
  };
}

/** Cap overconfident model scores when news shock or weak structure. */
export function normalizeConfidence(
  raw: number,
  opts?: { side?: TradeSide; newsShock?: boolean; hasSetup?: boolean },
): number {
  let c = Math.round(Number(raw));
  if (!Number.isFinite(c)) c = 0;
  c = Math.max(0, Math.min(100, c));
  if (opts?.side === "FLAT" || opts?.hasSetup === false) {
    c = Math.min(c, 55);
  }
  if (opts?.newsShock) {
    c = Math.min(c, 62);
  }
  // Soften extreme certainty
  if (c > 88) c = 88;
  return c;
}
