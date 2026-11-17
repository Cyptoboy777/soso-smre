/**
 * Pure low-fee grid maths: levels, preview, PnL and stop conditions.
 * No network, no keys, no order placement.
 */
import { decimalsOf, floorStep, stripZeros } from './swap-ux';
import type { GuardResult, GuardVerdict } from './trade-guard';

export const GRID_MIN_LEVELS = 2;
export const GRID_MAX_LEVELS = 20;
export const GRID_CLORD_PREFIX = 'gd-';
/** Price is "near the edge" when it sits in the outer 10% of the range. */
export const GRID_EDGE_PCT = 10;
/** Net step profit at or below this (percent of buy notional) is a Wait. */
export const GRID_THIN_PROFIT_PCT = 0.05;

export type GridConfig = {
  lower: number;
  upper: number;
  levels: number;
  budget: number;
  dailyLossCap: number;
  /** Maker fee as a fraction (0.0002 = 0.02%). Non-finite means unpublished. */
  makerFee?: number;
  /** Builder fee as a fraction per fill. Missing or 0 means none. */
  builderFee?: number;
  tick: string;
  step: string;
  minNotional: number;
  minQty: number;
};

export type GridLevel = {
  index: number;
  price: number;
  priceStr: string;
  qty: number;
  qtyStr: string;
  quote: number;
  startSide: 'buy' | 'sell' | 'skip';
};

export type GridLevelsOk = { ok: true; levels: GridLevel[]; spacing: number; minSpacing: number; spacingPct: number; uniqueRequested: boolean };
export type GridLevelsErr = { ok: false; error: string };
export type GridLevelsResult = GridLevelsOk | GridLevelsErr;

export type GridPreview = {
  levels: GridLevel[];
  levelCount: number;
  spacing: number;
  minSpacing: number;
  spacingPct: number;
  quotePerLevel: number;
  buyLevels: number;
  sellLevels: number;
  skippedLevels: number;
  buyQuote: number;
  sellBase: number;
  sellQuote: number;
  /** Gross profit of the tightest step, as % of the lower price of that step. */
  grossProfitPct: number;
  /** Net profit % after maker (+ builder) fees on both sides. Null if the maker fee is unpublished. */
  netProfitPct: number | null;
  /** USDC fees for one round trip on the tightest step. Null if the maker fee is unpublished. */
  roundTripFee: number | null;
  /** Mark-to-market loss if every start-buy fills and price goes to the lower bound. */
  worstCaseLoss: number;
  /** Average buy price of that worst-case inventory. */
  worstCaseAvgBuy: number;
  /** Round trips of the tightest step needed to cover worst-case loss. Null if net profit is not positive or fees are unpublished. */
  breakEvenRoundTrips: number | null;
  issues: string[];
  uniqueRequested: boolean;
};

export type GridFill = { side: 'buy' | 'sell'; price: number; qty: number; feeUsd: number };
export type GridStopReason = 'out-of-range' | 'daily-loss' | 'user-stop';

export function isGridClOrdId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(GRID_CLORD_PREFIX);
}

export function gridClOrdId(): string {
  return `${GRID_CLORD_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function roundTick(x: number, tick: string): string {
  const t = Number(tick);
  if (!(t > 0) || !Number.isFinite(x) || x <= 0) return '0';
  return stripZeros((Math.round(x / t) * t).toFixed(decimalsOf(tick)));
}

export function feePctText(fee: number | null | undefined): string | null {
  if (fee == null || !Number.isFinite(fee)) return null;
  return `${(fee * 100).toFixed(3)}%`;
}

/** Per-fill fee as a fraction: maker (if published) plus builder. Null if maker is unpublished. */
export function feeFraction(makerFee?: number, builderFee?: number): number | null {
  if (makerFee == null || !Number.isFinite(makerFee)) return null;
  const b = Number.isFinite(builderFee) ? Math.max(0, builderFee as number) : 0;
  return Math.max(0, makerFee) + b;
}

export function wouldTakeLiquidity(side: 'buy' | 'sell', price: number, bestBid?: number, bestAsk?: number): boolean {
  if (!(price > 0)) return false;
  if (side === 'buy') return (bestAsk ?? 0) > 0 && price >= bestAsk!;
  return (bestBid ?? 0) > 0 && price <= bestBid!;
}

export function validateGridInput(cfg: GridConfig): string[] {
  const issues: string[] = [];
  if (!(cfg.lower > 0) || !(cfg.upper > 0)) issues.push('Enter a lower and upper price greater than zero.');
  else if (!(cfg.upper > cfg.lower)) issues.push('The upper price must be above the lower price.');
  const n = Math.round(cfg.levels);
  if (!Number.isFinite(cfg.levels) || n < GRID_MIN_LEVELS || n > GRID_MAX_LEVELS) {
    issues.push(`Use between ${GRID_MIN_LEVELS} and ${GRID_MAX_LEVELS} grid levels.`);
  }
  if (!(cfg.budget > 0) || !Number.isFinite(cfg.budget)) issues.push('Enter a total amount greater than zero.');
  if (!Number.isFinite(cfg.dailyLossCap) || cfg.dailyLossCap <= 0) issues.push('Set a daily loss cap greater than zero so the grid can stop itself.');
  const tick = Number(cfg.tick);
  if (!(tick > 0)) issues.push('This pair has no usable price tick.');
  else if (cfg.upper > cfg.lower && (cfg.upper - cfg.lower) < tick) {
    issues.push('This range is tighter than the pair’s price tick, so distinct levels cannot be placed.');
  }
  return issues;
}

function startSideFor(price: number, last: number, tick: number): GridLevel['startSide'] {
  const eps = tick > 0 ? tick / 2 : 0;
  if (price < last - eps) return 'buy';
  if (price > last + eps) return 'sell';
  return 'skip';
}

export function buildGridLevels(cfg: GridConfig, lastPrice: number): GridLevelsResult {
  const issues = validateGridInput(cfg);
  // Levels can still be built without a daily loss cap / budget issues for preview; block only on range/tick/count.
  const blocking = issues.filter((m) =>
    m.includes('lower and upper') || m.includes('upper price must') || m.includes('grid levels') || m.includes('price tick') || m.includes('tighter than'),
  );
  if (blocking.length) return { ok: false, error: blocking[0] };
  if (!(lastPrice > 0) || !Number.isFinite(lastPrice)) return { ok: false, error: 'Waiting for a live price for this pair.' };

  const nReq = clampInt(Math.round(cfg.levels), GRID_MIN_LEVELS, GRID_MAX_LEVELS);
  const tickN = Number(cfg.tick);
  const raw: number[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nReq; i++) {
    const ideal = cfg.lower + ((cfg.upper - cfg.lower) * i) / (nReq - 1);
    const priceStr = roundTick(ideal, cfg.tick);
    const price = Number(priceStr);
    if (!(price > 0) || seen.has(priceStr)) continue;
    if (price < cfg.lower - tickN / 2 || price > cfg.upper + tickN / 2) continue;
    seen.add(priceStr);
    raw.push(price);
  }
  if (raw.length < 2) return { ok: false, error: 'This range and tick size do not allow two distinct prices. Widen the range or pick a pair with a finer tick.' };

  const minSpacing = raw.slice(1).reduce((m, p, i) => Math.min(m, p - raw[i]), Infinity);
  if (!(minSpacing > 0)) return { ok: false, error: 'This range and tick size do not allow two distinct prices. Widen the range or pick a pair with a finer tick.' };

  const quotePer = cfg.budget > 0 ? cfg.budget / raw.length : 0;
  const levels: GridLevel[] = raw.map((price, index) => {
    const priceStr = roundTick(price, cfg.tick);
    const qtyStr = quotePer > 0 ? floorStep(quotePer / price, cfg.step) : '0';
    const qty = Number(qtyStr) || 0;
    return {
      index,
      price,
      priceStr,
      qty,
      qtyStr,
      quote: qty * price,
      startSide: startSideFor(price, lastPrice, tickN),
    };
  });

  const spacing = (raw[raw.length - 1] - raw[0]) / (raw.length - 1);
  const mid = lastPrice;
  return {
    ok: true,
    levels,
    spacing,
    minSpacing,
    spacingPct: mid > 0 ? (minSpacing / mid) * 100 : 0,
    uniqueRequested: raw.length !== nReq,
  };
}

export function previewGrid(cfg: GridConfig, lastPrice: number): { ok: false; error: string } | { ok: true; preview: GridPreview } {
  const built = buildGridLevels(cfg, lastPrice);
  if (!built.ok) return built;

  const issues = validateGridInput(cfg);
  const { levels, spacing, minSpacing, spacingPct, uniqueRequested } = built;
  if (uniqueRequested) {
    issues.push(`This range and tick size only allow ${levels.length} distinct prices, so the grid uses ${levels.length} levels.`);
  }

  for (const lv of levels) {
    if (!(lv.qty > 0)) {
      issues.push('The amount per level rounds down to zero for this pair’s size step. Raise the total amount or use fewer levels.');
      break;
    }
    if (cfg.minQty > 0 && lv.qty + 1e-12 < cfg.minQty) {
      issues.push(`Each level must be at least ${cfg.minQty} of the base token.`);
      break;
    }
    if (cfg.minNotional > 0 && lv.quote + 1e-9 < cfg.minNotional) {
      issues.push(`Each level is about ${usdPlain(lv.quote)}, below this pair’s minimum order of ${usdPlain(cfg.minNotional)}. Raise the total amount or use fewer levels.`);
      break;
    }
  }

  const buys = levels.filter((l) => l.startSide === 'buy');
  const sells = levels.filter((l) => l.startSide === 'sell');
  const buyQuote = buys.reduce((s, l) => s + l.quote, 0);
  const sellBase = sells.reduce((s, l) => s + l.qty, 0);
  const sellQuote = sells.reduce((s, l) => s + l.quote, 0);

  // Tightest adjacent step for conservative fee / profit figures.
  let tightLo = levels[0];
  let tightHi = levels[1];
  for (let i = 1; i < levels.length; i++) {
    if (levels[i].price - levels[i - 1].price < tightHi.price - tightLo.price) {
      tightLo = levels[i - 1];
      tightHi = levels[i];
    }
  }
  const stepQty = Math.min(tightLo.qty, tightHi.qty);
  const buyNotional = tightLo.price * stepQty;
  const sellNotional = tightHi.price * stepQty;
  const gross = (tightHi.price - tightLo.price) * stepQty;
  const grossProfitPct = buyNotional > 0 ? (gross / buyNotional) * 100 : 0;

  const frac = feeFraction(cfg.makerFee, cfg.builderFee);
  let netProfitPct: number | null = null;
  let roundTripFee: number | null = null;
  if (frac != null && stepQty > 0) {
    roundTripFee = frac * buyNotional + frac * sellNotional;
    const net = gross - roundTripFee;
    netProfitPct = buyNotional > 0 ? (net / buyNotional) * 100 : 0;
    if (net <= 0) issues.push('Maker fees on a buy and a sell would eat the whole step. Widen the range or use fewer levels.');
  }

  const worstQty = buys.reduce((s, l) => s + l.qty, 0);
  const worstCost = buys.reduce((s, l) => s + l.quote, 0);
  const worstMark = worstQty * cfg.lower;
  const worstCaseLoss = Math.max(0, worstCost - worstMark);
  const worstCaseAvgBuy = worstQty > 0 ? worstCost / worstQty : 0;

  let breakEvenRoundTrips: number | null = null;
  if (frac != null && stepQty > 0) {
    const net = gross - (frac * buyNotional + frac * sellNotional);
    if (net > 0) breakEvenRoundTrips = worstCaseLoss <= 0 ? 0 : Math.ceil((worstCaseLoss - 1e-12) / net);
  }

  if (lastPrice > 0 && (lastPrice < cfg.lower || lastPrice > cfg.upper)) {
    issues.push('The live price is already outside this range, so the grid would stop immediately.');
  }
  if (cfg.dailyLossCap > 0 && worstCaseLoss >= cfg.dailyLossCap) {
    issues.push('A drop to the lower bound could exceed your daily loss cap.');
  }

  return {
    ok: true,
    preview: {
      levels,
      levelCount: levels.length,
      spacing,
      minSpacing,
      spacingPct,
      quotePerLevel: cfg.budget > 0 ? cfg.budget / levels.length : 0,
      buyLevels: buys.length,
      sellLevels: sells.length,
      skippedLevels: levels.filter((l) => l.startSide === 'skip').length,
      buyQuote,
      sellBase,
      sellQuote,
      grossProfitPct,
      netProfitPct,
      roundTripFee,
      worstCaseLoss,
      worstCaseAvgBuy,
      breakEvenRoundTrips,
      issues,
      uniqueRequested,
    },
  };
}

export function oppositeIndex(filledIndex: number, filledSide: 'buy' | 'sell', levelCount: number): number | null {
  if (!Number.isInteger(filledIndex) || filledIndex < 0 || filledIndex >= levelCount) return null;
  if (filledSide === 'buy') {
    const next = filledIndex + 1;
    return next < levelCount ? next : null;
  }
  const prev = filledIndex - 1;
  return prev >= 0 ? prev : null;
}

export function shouldStopGrid(input: {
  lastPrice: number;
  lower: number;
  upper: number;
  realizedPnl: number;
  markToMarket: number;
  dailyLossCap: number;
  userStop?: boolean;
}): { stop: boolean; reason: GridStopReason | null } {
  if (input.userStop) return { stop: true, reason: 'user-stop' };
  const last = input.lastPrice;
  if (Number.isFinite(last) && last > 0 && Number.isFinite(input.lower) && Number.isFinite(input.upper)) {
    if (last < input.lower || last > input.upper) return { stop: true, reason: 'out-of-range' };
  }
  if (input.dailyLossCap > 0 && Number.isFinite(input.realizedPnl) && Number.isFinite(input.markToMarket)) {
    if (input.realizedPnl + input.markToMarket <= -input.dailyLossCap) return { stop: true, reason: 'daily-loss' };
  }
  return { stop: false, reason: null };
}

/** FIFO inventory and realized PnL. Fees are already converted to USDC by the caller. */
export function inventoryFromFills(fills: GridFill[]): { base: number; costUsd: number; realizedPnl: number } {
  const lots: { qty: number; costUsd: number }[] = [];
  let realizedPnl = 0;
  for (const f of fills) {
    if (!(f.qty > 0) || !(f.price > 0)) continue;
    const fee = Number.isFinite(f.feeUsd) ? Math.max(0, f.feeUsd) : 0;
    if (f.side === 'buy') {
      lots.push({ qty: f.qty, costUsd: f.price * f.qty + fee });
      continue;
    }
    let left = f.qty;
    const feePer = f.qty > 0 ? fee / f.qty : 0;
    for (const lot of lots) {
      if (!(left > 0) || !(lot.qty > 0)) continue;
      const take = Math.min(lot.qty, left);
      const cost = lot.qty > 0 ? lot.costUsd * (take / lot.qty) : 0;
      realizedPnl += f.price * take - cost - feePer * take;
      lot.costUsd -= cost;
      lot.qty -= take;
      left -= take;
    }
    if (left > 0) realizedPnl += f.price * left - feePer * left;
  }
  let base = 0;
  let costUsd = 0;
  for (const lot of lots) {
    if (lot.qty > 1e-12) {
      base += lot.qty;
      costUsd += lot.costUsd;
    }
  }
  return { base, costUsd, realizedPnl };
}

export function markToMarketPnl(base: number, costUsd: number, lastPrice: number): number {
  if (!(base > 0) || !Number.isFinite(lastPrice)) return 0;
  return base * lastPrice - costUsd;
}

/** Convert an exchange fee to USDC when the coin is known. Returns null if it cannot be converted honestly. */
export function feeToUsd(fee: number, feeCoin: string, fillPrice: number, quoteCoins: string[], baseCoins: string[]): number | null {
  if (!Number.isFinite(fee) || fee < 0) return null;
  const c = (feeCoin || '').trim();
  if (!c) return null;
  const q = new Set(quoteCoins.map((x) => x.toLowerCase()));
  const b = new Set(baseCoins.map((x) => x.toLowerCase()));
  const key = c.toLowerCase();
  if (q.has(key)) return fee;
  if (b.has(key)) return Number.isFinite(fillPrice) && fillPrice > 0 ? fee * fillPrice : null;
  return null;
}

export type GridVerdict = { verdict: GuardVerdict; reasons: string[] };

export function gridStyleVerdict(preview: GridPreview, lastPrice: number, lower: number, upper: number, halted: boolean): GridVerdict {
  const bad: string[] = [];
  const warn: string[] = [];
  if (halted) bad.push('This market is not in trading status right now.');
  if (lastPrice > 0 && (lastPrice < lower || lastPrice > upper)) {
    bad.push('The live price is already outside this range.');
  } else if (lastPrice > 0 && upper > lower) {
    const pos = ((lastPrice - lower) / (upper - lower)) * 100;
    if (pos <= GRID_EDGE_PCT || pos >= 100 - GRID_EDGE_PCT) {
      warn.push('The live price is close to the edge of this range, so the grid may stop soon.');
    }
  }
  if (preview.netProfitPct != null && preview.netProfitPct <= 0) {
    bad.push('Fees on a round trip would eat the whole step.');
  } else if (preview.netProfitPct != null && preview.netProfitPct <= GRID_THIN_PROFIT_PCT) {
    warn.push(`Net profit after maker fees is only about ${preview.netProfitPct.toFixed(3)}% per step.`);
  }
  if (preview.issues.some((i) => i.includes('daily loss cap'))) {
    warn.push('A drop to the lower bound could exceed your daily loss cap.');
  }
  const startBlock = preview.issues.some((i) => i.includes('would stop immediately') || i.includes('rounds down to zero') || i.includes('minimum order') || i.includes('at least'));
  if (startBlock && !bad.length) warn.push(...preview.issues.filter((i) => !warn.includes(i) && !bad.includes(i)));

  if (bad.length) return { verdict: 'risky', reasons: [...bad, ...warn].slice(0, 6) };
  if (warn.length) return { verdict: 'wait', reasons: warn.slice(0, 6) };
  const good = ['Maker limit orders at each level, with a preview of fees and the worst-case drop to the lower bound.'];
  if (preview.netProfitPct != null && preview.netProfitPct > 0) {
    good.unshift(`About ${preview.netProfitPct.toFixed(3)}% net per step after maker fees.`);
  }
  return { verdict: 'good', reasons: good.slice(0, 3) };
}

export function combineGridVerdict(grid: GridVerdict, guard?: GuardResult | null): GridVerdict {
  const rank: Record<GuardVerdict, number> = { good: 0, wait: 1, risky: 2 };
  let verdict = grid.verdict;
  const reasons = [...grid.reasons];
  if (guard) {
    if (rank[guard.verdict] > rank[verdict]) verdict = guard.verdict;
    for (const r of guard.reasons) if (!reasons.includes(r)) reasons.push(r);
  }
  return { verdict, reasons: reasons.slice(0, 6) };
}

function clampInt(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function usdPlain(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
