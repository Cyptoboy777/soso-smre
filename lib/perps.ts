/**
 * Perps (futures) risk math: pure logic, no network, no orders.
 * Sources: docs.sodex.com trading-mechanics (margining, margin tiers, liquidations) and the official SoDEX SDKs.
 * Liquidation estimate (docs): liq = price - side * marginAvailable / size / (1 - l * side),
 * with l = maintenance margin rate of the tier and marginAvailable = margin - maintenance margin at entry.
 * Maintenance margin (docs): notional * maintenanceMarginRate - maintenanceDeduction, by tier.
 */
import { ema, atr, type Candle } from './setup';

export type Tier = { maxNotional: number; mmr: number; deduction: number; maxLev: number };
export type PerpSide = 'long' | 'short';
export type PerpVerdict = 'go' | 'wait' | 'risky';

export const DEFAULT_RISK_PCT = 1;
export const DEFAULT_LEVERAGE = 2;
export const HARD_MAX_LEVERAGE = 10; // our own cap, below most SoDEX symbol limits
export const LIQ_STOP_MULT = 2; // liquidation must be at least 2x farther than the stop
export const ATR_STOP_MULT = 1.5;
export const REWARD_RISK = 2;
export const HIGH_FUNDING = 0.0005; // 0.05% per funding interval
export const SPREAD_WAIT_PCT = 0.3;
export const SPREAD_RISKY_PCT = 1;
export const DEFAULT_DAILY_LOSS_PCT = 3;
export const DEFAULT_MAX_OPEN = 3;

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const sgn = (s: PerpSide) => (s === 'long' ? 1 : -1);

export function parseTiers(raw: unknown): Tier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t: any) => ({ maxNotional: n(t?.maxNotionalValue), mmr: n(t?.maintenanceMarginRate), deduction: n(t?.maintenanceDeduction), maxLev: n(t?.maxLeverage) }))
    .filter((t) => t.maxNotional > 0 && t.mmr > 0 && t.mmr < 1 && t.maxLev > 0)
    .sort((a, b) => a.maxNotional - b.maxNotional);
}

/** Tier used for a position of this notional; the last tier if larger. Falls back to 50% of 1/maxLev (docs rule). */
export function tierFor(tiers: Tier[], notional: number, maxLev = 0): Tier {
  const t = tiers.find((x) => notional <= x.maxNotional) ?? tiers[tiers.length - 1];
  if (t) return t;
  const lev = maxLev > 0 ? maxLev : 1;
  return { maxNotional: Infinity, mmr: 1 / lev / 2, deduction: 0, maxLev: lev };
}

export function maintenanceMargin(tiers: Tier[], notional: number, maxLev = 0): number {
  const t = tierFor(tiers, notional, maxLev);
  return Math.max(0, notional * t.mmr - t.deduction);
}

/** Estimated liquidation price for one position backed only by `margin`. Returns 0 (long) when margin covers the full notional. */
export function liqPrice(i: { side: PerpSide; entry: number; size: number; margin: number; tiers: Tier[]; maxLev?: number }): number {
  const { entry, size, margin } = i;
  if (!(entry > 0 && size > 0 && margin > 0)) return NaN;
  const s = sgn(i.side);
  const notional = entry * size;
  const t = tierFor(i.tiers, notional, i.maxLev);
  const available = margin - maintenanceMargin(i.tiers, notional, i.maxLev);
  const p = entry - (s * available) / size / (1 - t.mmr * s);
  return Math.max(0, p);
}

export const initialMargin = (notional: number, lev: number) => (lev > 0 ? notional / lev : NaN);

/** Leverage the user may pick: our hard cap, the symbol cap, and the tier cap for this notional. */
export function maxLeverageFor(symbolMax: number, tiers: Tier[], notional = 0): number {
  const tierMax = tiers.length ? tierFor(tiers, notional, symbolMax).maxLev : symbolMax;
  return Math.max(1, Math.floor(Math.min(HARD_MAX_LEVERAGE, symbolMax > 0 ? symbolMax : 1, tierMax > 0 ? tierMax : 1)));
}

export function decimalsOf(step: string | number): number {
  const s = String(step);
  if (/e-/i.test(s)) return Number(s.split(/e-/i)[1]) || 0;
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.replace(/0+$/, '').length - i - 1;
}
/** Round down to a multiple of step and return a plain decimal string (never scientific notation). */
export function floorTo(v: number, step: string | number): string {
  const st = Number(step);
  if (!(v > 0) || !(st > 0)) return '0';
  const d = decimalsOf(step);
  const k = Math.floor(v / st + 1e-9);
  return (k * st).toFixed(d);
}
export function roundTo(v: number, step: string | number): string {
  const st = Number(step);
  if (!(v > 0) || !(st > 0)) return '0';
  return (Math.round(v / st) * st).toFixed(decimalsOf(step));
}

/** Quantity such that hitting the stop (plus taker fees in and out) loses at most riskPct of equity. */
export function sizeByRisk(i: { equity: number; riskPct: number; entry: number; stop: number; feeRate: number; step: string; maxQty?: number }): { qty: number; qtyStr: string; riskUsd: number; lossAtStop: number } {
  const per = Math.abs(i.entry - i.stop) + (i.entry + i.stop) * Math.max(0, i.feeRate);
  const riskUsd = Math.max(0, i.equity) * (Math.max(0, i.riskPct) / 100);
  if (!(per > 0) || !(riskUsd > 0) || !(i.entry > 0)) return { qty: 0, qtyStr: '0', riskUsd, lossAtStop: 0 };
  let q = riskUsd / per;
  if (i.maxQty && i.maxQty > 0) q = Math.min(q, i.maxQty);
  const qtyStr = floorTo(q, i.step);
  const qty = Number(qtyStr);
  return { qty, qtyStr, riskUsd, lossAtStop: qty * per };
}

export function stopTarget(i: { side: PerpSide; entry: number; atr: number; mult?: number; rr?: number }): { stop: number; target: number } {
  const s = sgn(i.side);
  const d = Math.max(0, i.atr) * (i.mult ?? ATR_STOP_MULT);
  return { stop: i.entry - s * d, target: i.entry + s * d * (i.rr ?? REWARD_RISK) };
}

/** Funding paid (+) or received (-) over `hours` by this side. Positive rate: longs pay shorts. */
export function fundingCost(i: { side: PerpSide; notional: number; rate: number; hours: number; intervalHrs: number }): number {
  if (!(i.intervalHrs > 0)) return 0;
  return sgn(i.side) * i.notional * i.rate * (i.hours / i.intervalHrs);
}

export type GuardOut = { ok: boolean; liq: number; liqDist: number; stopDist: number; reason?: string };
/** Block when liquidation is closer than LIQ_STOP_MULT x the stop distance, or on the wrong side of the stop. */
export function liqGuard(i: { side: PerpSide; entry: number; stop: number; liq: number }): GuardOut {
  const stopDist = Math.abs(i.entry - i.stop);
  const liqDist = Number.isFinite(i.liq) ? Math.abs(i.entry - i.liq) : 0;
  const wrongSide = i.side === 'long' ? !(i.stop < i.entry) : !(i.stop > i.entry);
  if (wrongSide) return { ok: false, liq: i.liq, liqDist, stopDist, reason: 'The stop is on the wrong side of the entry.' };
  if (i.side === 'long' && i.liq <= 0) return { ok: true, liq: i.liq, liqDist, stopDist };
  const ok = liqDist >= LIQ_STOP_MULT * stopDist;
  return { ok, liq: i.liq, liqDist, stopDist, reason: ok ? undefined : `Liquidation would be closer than ${LIQ_STOP_MULT}x the stop distance. Lower the leverage.` };
}

/** Highest leverage at or below `want` where the liquidation guard passes; null when even 1x fails. */
export function safestLeverage(i: { side: PerpSide; entry: number; stop: number; size: number; tiers: Tier[]; want: number; maxLev?: number }): number | null {
  for (let lev = Math.max(1, Math.floor(i.want)); lev >= 1; lev--) {
    const margin = initialMargin(i.entry * i.size, lev);
    const liq = liqPrice({ side: i.side, entry: i.entry, size: i.size, margin, tiers: i.tiers, maxLev: i.maxLev });
    if (liqGuard({ side: i.side, entry: i.entry, stop: i.stop, liq }).ok) return lev;
  }
  return null;
}

export const dailyLossHit = (realizedTodayUsd: number, equity: number, capPct = DEFAULT_DAILY_LOSS_PCT) => equity > 0 && realizedTodayUsd < 0 && -realizedTodayUsd >= equity * (capPct / 100);
export const canOpenMore = (openPositions: number, maxOpen = DEFAULT_MAX_OPEN) => openPositions < maxOpen;

export type Trend = 'up' | 'down' | 'mixed' | 'unknown';
export function trendOf(c: Candle[]): Trend {
  if (c.length < 55) return 'unknown';
  const closes = c.map((x) => x.c);
  const f = ema(closes, 20), s = ema(closes, 50);
  if (f == null || s == null) return 'unknown';
  const last = closes[closes.length - 1];
  if (f > s && last > s) return 'up';
  if (f < s && last < s) return 'down';
  return 'mixed';
}

export type PerpSetupIn = {
  c1h: Candle[]; c4h: Candle[]; mark: number; bid: number; ask: number;
  funding?: number; fundingHrs: number; takerFee: number; builderFeeRate?: number;
  tiers: Tier[]; symbolMaxLev: number; step: string; tick: string; minQty: number; minNotional: number; maxQty?: number;
  equity: number; available: number; riskPct: number; leverage: number; side?: PerpSide;
  openPositions: number; maxOpen?: number; realizedToday?: number; dailyCapPct?: number;
};
export type PerpSetupOut = {
  verdict: PerpVerdict; blocked: boolean; side: PerpSide | null; trend1h: Trend; trend4h: Trend;
  entry: number; stop: number; target: number; qty: number; qtyStr: string; notional: number; leverage: number;
  margin: number; liq: number; feesUsd: number; funding8hUsd?: number; lossAtStop: number; gainAtTarget: number; spreadPct: number;
  stopStr: string; targetStr: string; reasons: string[];
};

/** The whole "Get setup" decision. Code decides every number and the verdict; AI only explains it. */
export function computePerpSetup(i: PerpSetupIn): PerpSetupOut {
  const reasons: string[] = [];
  const t1 = trendOf(i.c1h), t4 = trendOf(i.c4h);
  const trendSide: PerpSide | null = t1 === 'up' && t4 === 'up' ? 'long' : t1 === 'down' && t4 === 'down' ? 'short' : null;
  const side: PerpSide | null = i.side ?? trendSide;
  const mid = i.bid > 0 && i.ask > 0 ? (i.bid + i.ask) / 2 : i.mark;
  const spreadPct = i.bid > 0 && i.ask > 0 ? ((i.ask - i.bid) / mid) * 100 : 0;
  const empty: PerpSetupOut = { verdict: 'wait', blocked: true, side, trend1h: t1, trend4h: t4, entry: 0, stop: 0, target: 0, qty: 0, qtyStr: '0', notional: 0, leverage: 0, margin: 0, liq: NaN, feesUsd: 0, lossAtStop: 0, gainAtTarget: 0, spreadPct, stopStr: '0', targetStr: '0', reasons };

  if (i.realizedToday != null && dailyLossHit(i.realizedToday, i.equity, i.dailyCapPct)) { reasons.push(`Daily loss limit reached (${i.dailyCapPct ?? DEFAULT_DAILY_LOSS_PCT}% of balance). No new trades today.`); return { ...empty, verdict: 'risky' }; }
  if (!canOpenMore(i.openPositions, i.maxOpen)) { reasons.push(`You already have ${i.openPositions} open positions, the most this app allows at once.`); return { ...empty, verdict: 'risky' }; }
  if (!(i.mark > 0)) { reasons.push('No live mark price for this market.'); return empty; }
  const a = atr(i.c1h, 14);
  if (!side) { reasons.push(t1 === 'unknown' || t4 === 'unknown' ? 'Not enough price history to read the trend.' : 'The 1h and 4h trends disagree. Waiting is the low-risk choice.'); return { ...empty, verdict: 'wait' }; }
  if (a == null || !(a > 0)) { reasons.push('Not enough price history to measure volatility.'); return empty; }

  const entry = side === 'long' ? (i.ask > 0 ? i.ask : i.mark) : (i.bid > 0 ? i.bid : i.mark);
  const st = stopTarget({ side, entry, atr: a });
  const stopStr = roundTo(st.stop, i.tick), targetStr = roundTo(st.target, i.tick);
  const stop = Number(stopStr), target = Number(targetStr);
  const feeRate = Math.max(0, i.takerFee) + Math.max(0, i.builderFeeRate ?? 0);
  const sz = sizeByRisk({ equity: i.equity, riskPct: i.riskPct, entry, stop, feeRate, step: i.step, maxQty: i.maxQty });
  let qty = sz.qty, qtyStr = sz.qtyStr;
  const wantLev = Math.min(Math.max(1, Math.floor(i.leverage)), maxLeverageFor(i.symbolMaxLev, i.tiers, entry * qty));
  // Margin cap: the position's initial margin must fit the available margin.
  if (qty > 0 && i.available > 0 && (entry * qty) / wantLev > i.available) {
    qtyStr = floorTo((i.available * wantLev) / entry, i.step); qty = Number(qtyStr);
    reasons.push('Size trimmed to fit your available margin.');
  }
  const notional = entry * qty;
  let verdict: PerpVerdict = 'go';
  let blocked = false;
  const bump = (v: PerpVerdict) => { if (v === 'risky' || (v === 'wait' && verdict === 'go')) verdict = v; };

  if (trendSide && side !== trendSide) { reasons.push(`This ${side} goes against the 1h and 4h trend.`); bump('risky'); }
  else if (!trendSide) { reasons.push(`The trend does not clearly support a ${side}.`); bump('risky'); }
  if (!(qty > 0) || qty < i.minQty || notional < i.minNotional) {
    reasons.push(`At ${i.riskPct}% risk the size is below this market's minimum (${i.minNotional} USDC). Add funds or skip this one.`);
    return { ...empty, side, verdict: 'wait', spreadPct, stopStr, targetStr, entry, stop, target, reasons };
  }

  let lev = safestLeverage({ side, entry, stop, size: qty, tiers: i.tiers, want: wantLev, maxLev: i.symbolMaxLev });
  if (lev == null) { reasons.push('Even at 1x the liquidation price is too close to the stop.'); blocked = true; bump('risky'); lev = 1; }
  else if (lev < wantLev) reasons.push(`Leverage lowered from ${wantLev}x to ${lev}x so liquidation stays at least ${LIQ_STOP_MULT}x farther than the stop.`);
  const margin = initialMargin(notional, lev);
  if (i.available > 0 && margin > i.available) { reasons.push('Not enough available margin for this size.'); blocked = true; bump('wait'); }
  const liq = liqPrice({ side, entry, size: qty, margin, tiers: i.tiers, maxLev: i.symbolMaxLev });

  if (spreadPct >= SPREAD_RISKY_PCT) { reasons.push(`Spread is wide (${spreadPct.toFixed(2)}%).`); bump('risky'); }
  else if (spreadPct >= SPREAD_WAIT_PCT) { reasons.push(`Spread is a bit wide (${spreadPct.toFixed(2)}%).`); bump('wait'); }
  let funding8hUsd: number | undefined;
  if (i.funding != null && i.fundingHrs > 0) {
    funding8hUsd = fundingCost({ side, notional, rate: i.funding, hours: 8, intervalHrs: i.fundingHrs });
    if (sgn(side) * i.funding >= HIGH_FUNDING) { reasons.push(`Funding is high for ${side}s (${(i.funding * 100).toFixed(3)}% each ${i.fundingHrs}h).`); bump('wait'); }
  }
  const feesUsd = (entry + target) * qty * feeRate;
  if (verdict === 'go') reasons.push(`1h and 4h trends agree. Stop at 1.5x ATR, target at ${REWARD_RISK}:1.`);
  return {
    verdict, blocked, side, trend1h: t1, trend4h: t4, entry, stop, target, qty, qtyStr, notional, leverage: lev, margin, liq, feesUsd, funding8hUsd,
    lossAtStop: Math.abs(entry - stop) * qty + (entry + stop) * qty * feeRate, gainAtTarget: Math.abs(target - entry) * qty - feesUsd, spreadPct, stopStr, targetStr, reasons,
  };
}

/** Live order-form preview for any user-typed order. */
export function orderPreview(i: { side: PerpSide; price: number; qty: number; leverage: number; feeRate: number; tiers: Tier[]; maxLev?: number; stop?: number }) {
  const notional = i.price * i.qty;
  const margin = initialMargin(notional, i.leverage);
  const liq = liqPrice({ side: i.side, entry: i.price, size: i.qty, margin, tiers: i.tiers, maxLev: i.maxLev });
  const fees = notional * Math.max(0, i.feeRate);
  const guard = i.stop && i.stop > 0 ? liqGuard({ side: i.side, entry: i.price, stop: i.stop, liq }) : null;
  return { notional, margin, liq, fees, guard };
}
