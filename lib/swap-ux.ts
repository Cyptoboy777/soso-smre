/**
 * Pure helpers for Swap UX: percent/MAX amounts, price-move checks, and recent pairs.
 * No network, no keys, no wallet addresses.
 */

/** Route Preview walks the live SoDEX book on this interval (SwapPanel useBooks). */
export const SWAP_QUOTE_POLL_MS = 1800;

/** 0.05% — in line with a typical SoDEX taker fee, used only on quote-coin MAX. */
export const QUOTE_FEE_BUFFER_BPS = 5;
/** At least one USDC cent is left behind when the fee buffer is on. */
export const QUOTE_FEE_BUFFER_MIN = 0.01;
export const QUOTE_DECIMALS = 6;
export const RECENT_PAIRS_KEY = 'soswap.recentPairs';
export const RECENT_PAIRS_MAX = 3;
export const LEAVE_FEES_KEY = 'soswap.leaveFees';

export type RecentPair = { from: string; to: string };

export type AmountChipInput = {
  /** Spot available: total − locked. Never margin. */
  available: number;
  fraction: number;
  isQuote: boolean;
  /** Exchange lot size for base coins. */
  step?: string;
  quoteDecimals?: number;
  /** When true and fraction is 1 on a quote coin, leave a small fee buffer. */
  leaveFeeBuffer?: boolean;
};

export function decimalsOf(step: string): number {
  const i = step.indexOf('.');
  return i < 0 ? 0 : step.length - i - 1;
}

export function stripZeros(s: string): string {
  return (s.includes('.') ? s.replace(/\.?0+$/, '') : s) || '0';
}

/** Floor to the exchange step with no trailing zeros (the API rejects "0.4060"). */
export function floorStep(x: number, step: string): string {
  const st = Number(step);
  if (!(st > 0) || !isFinite(x) || x <= 0) return '0';
  const n = Math.floor(x / st + 1e-9);
  return stripZeros((n * st).toFixed(decimalsOf(step)));
}

export function fixedStr(x: number, dec: number): string {
  if (!isFinite(x) || x <= 0) return '0';
  const p = 10 ** dec;
  return stripZeros((Math.floor(x * p + 1e-9) / p).toFixed(dec));
}

export function quoteFeeBuffer(available: number): number {
  const avail = Math.max(0, available);
  return Math.max(QUOTE_FEE_BUFFER_MIN, avail * (QUOTE_FEE_BUFFER_BPS / 10_000));
}

/** Amount string for a 25% / 50% / MAX chip. Uses only the spot available passed in. */
export function amountForPercent(opts: AmountChipInput): string {
  const avail = Math.max(0, Number(opts.available) || 0);
  if (!(avail > 0) || !(opts.fraction > 0)) return '0';
  let raw = avail * opts.fraction;
  if (opts.fraction === 1 && opts.isQuote && opts.leaveFeeBuffer) {
    raw = Math.max(0, avail - quoteFeeBuffer(avail));
  }
  if (opts.isQuote) return fixedStr(raw, opts.quoteDecimals ?? QUOTE_DECIMALS);
  if (!opts.step) return '0';
  return floorStep(raw, opts.step);
}

/** Absolute percent change of an expected conversion rate. */
export function priceMovePct(previewRate: number, liveRate: number): number {
  if (!(previewRate > 0) || !(liveRate > 0) || !isFinite(previewRate) || !isFinite(liveRate)) return 0;
  return (Math.abs(liveRate - previewRate) / previewRate) * 100;
}

/** Warn when the live rate has moved more than the user's slippage since the preview. */
export function shouldWarnPriceMove(previewRate: number, liveRate: number, slippagePct: number): boolean {
  const slip = Math.max(0, Number(slippagePct) || 0);
  return priceMovePct(previewRate, liveRate) > slip;
}

const KEY_RE = /^[A-Za-z0-9.]{1,16}$/;
function looksLikeAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{20,}$/.test(s) || s.length > 16;
}

export function isTokenKey(s: unknown): s is string {
  return typeof s === 'string' && KEY_RE.test(s) && !looksLikeAddress(s);
}

export function normalizeRecentPair(raw: unknown): RecentPair | null {
  if (!raw || typeof raw !== 'object') return null;
  const from = (raw as { from?: unknown }).from;
  const to = (raw as { to?: unknown }).to;
  if (!isTokenKey(from) || !isTokenKey(to) || from === to) return null;
  return { from, to };
}

export function readRecentPairs(raw: unknown): RecentPair[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentPair[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const p = normalizeRecentPair(item);
    if (!p) continue;
    const k = `${p.from}\0${p.to}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= RECENT_PAIRS_MAX) break;
  }
  return out;
}

/** Most-recent first, max 3, no addresses. Same directed pair is moved to the front. */
export function pushRecentPair(list: RecentPair[], from: string, to: string): RecentPair[] {
  const p = normalizeRecentPair({ from, to });
  if (!p) return readRecentPairs(list);
  const rest = readRecentPairs(list).filter((x) => !(x.from === p.from && x.to === p.to));
  return [p, ...rest].slice(0, RECENT_PAIRS_MAX);
}

export function formatPriceMove(movedPct: number): string {
  const n = isFinite(movedPct) ? movedPct : 0;
  const shown = n < 0.01 ? '<0.01' : n.toFixed(n < 1 ? 2 : 1);
  return `Price moved ${shown}%. Re-check before signing?`;
}

export type FlightStatus = 'submitting' | 'submitted' | 'filled' | 'partial' | 'failed' | 'cancelled';

export function classifyOrderStatus(raw: string, executed: number, qty?: number): FlightStatus | 'open' {
  const s = String(raw || '').toLowerCase();
  if (/partial/.test(s)) return 'partial';
  if (/filled/.test(s) || s === 'fill') return 'filled';
  if (/cancel/.test(s)) return 'cancelled';
  if (/reject|expir|fail/.test(s)) return 'failed';
  if (qty != null && qty > 0 && executed > 0 && executed < qty - 1e-12) return 'partial';
  if (qty != null && qty > 0 && executed >= qty - 1e-12) return 'filled';
  return 'open';
}
