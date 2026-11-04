/**
 * User-facing display helpers (pairs, prices, news tokens).
 */

const NEWS_TOKEN_RE = /\[(?:news:?\s*)?\d{6,}\]/gi;

export function stripNewsTokens(raw: string): string {
  return String(raw ?? '')
    .replace(NEWS_TOKEN_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

/** vBTC_vUSDC -> BTC/USDC */
export function formatPair(symbol: string | null | undefined): string {
  if (!symbol) return '';
  return String(symbol)
    .replace(/^v/i, '')
    .replace(/_v/gi, '/')
    .replace(/_/g, '/')
    .toUpperCase();
}

export function formatSideLabel(side: string | null | undefined): string {
  const s = String(side ?? '').toUpperCase();
  if (s === 'LONG') return 'Bullish';
  if (s === 'SHORT') return 'Bearish';
  if (s === 'FLAT') return 'Neutral';
  return side ? String(side) : 'Neutral';
}

/** Smart crypto price formatting (handles PEPE/SHIB-scale values). */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  const n = Number(value);
  const abs = Math.abs(n);
  if (abs === 0) return '0';
  if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (abs >= 0.01) return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  // Tiny prices (PEPE/SHIB): keep significant digits, optional subscript zero run
  const fixed = n.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  const sign = n < 0 ? '-' : '';
  const body = fixed.replace(/^-/, '');
  if (!body.startsWith('0.')) return fixed;
  const decimals = body.slice(2);
  let zeros = 0;
  while (zeros < decimals.length && decimals[zeros] === '0') zeros += 1;
  const rest = decimals.slice(zeros).slice(0, 5);
  if (zeros >= 4 && rest) {
    const sub = String(zeros).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]!);
    return `${sign}0.0${sub}${rest}`;
  }
  return `${sign}0.${decimals.slice(0, Math.max(zeros + 4, 8))}`.replace(/0+$/, '').replace(/\.$/, '') || fixed;
}

export function formatVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  const n = Math.abs(Number(value));
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function riskReward(entry: number, stop: number, target: number, side: string): string | null {
  if (![entry, stop, target].every((x) => Number.isFinite(x) && x > 0)) return null;
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  if (risk < 1e-12) return null;
  const rr = reward / risk;
  if (!Number.isFinite(rr) || rr <= 0) return null;
  return `1:${rr.toFixed(2)}`;
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

/** Clean public-facing text: news ids, internal symbols wording, FLAT labels. */
export function sanitizePublicText(raw: string): string {
  let text = stripNewsTokens(raw);
  text = text.replace(/\bvBTC_vUSDC\b/g, 'BTC/USDC');
  text = text.replace(/\bvETH_vUSDC\b/g, 'ETH/USDC');
  text = text.replace(/\bvSOL_vUSDC\b/g, 'SOL/USDC');
  text = text.replace(/\bv([A-Z0-9]+)_v([A-Z0-9]+)\b/g, '$1/$2');
  text = text.replace(/\bSHORT on\b/gi, 'Bearish on');
  text = text.replace(/\bLONG on\b/gi, 'Bullish on');
  text = text.replace(/\bFLAT on\b/gi, 'Neutral on');
  text = text.replace(/\bis FLAT\b/gi, 'is Neutral');
  text = text.replace(/\bFLAT\b/g, 'Neutral');
  text = text.replace(/\u2014/g, ',').replace(/\u2013/g, '-');
  return text.replace(/\s{2,}/g, ' ').trim();
}
