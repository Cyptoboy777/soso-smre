/** Convert a human token amount to and from the integer smallest unit, without floating-point rounding. */
export function toSmallest(human: string, decimals: number): string | null {
  const s = human.trim();
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const [wRaw, fRaw = ''] = s.split('.');
  if (fRaw.length > decimals) return null;
  const w = wRaw.replace(/^0+(?=\d)/, '');
  const frac = fRaw.padEnd(decimals, '0');
  const combined = (w + frac).replace(/^0+(?=\d)/, '');
  return combined || '0';
}

export function fromSmallest(raw: string, decimals: number): string {
  if (!/^\d+$/.test(raw)) return '0';
  if (decimals === 0) return raw.replace(/^0+(?=\d)/, '') || '0';
  const s = raw.padStart(decimals + 1, '0');
  const i = s.length - decimals;
  const whole = s.slice(0, i).replace(/^0+(?=\d)/, '') || '0';
  const frac = s.slice(i).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

export function toNumber(human: string): number {
  const n = Number(human);
  return Number.isFinite(n) ? n : 0;
}
