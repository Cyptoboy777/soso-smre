/**
 * News links come from a third-party API, so treat them as untrusted.
 * Only absolute http(s) URLs are allowed; javascript:, data:, vbscript:, relative or malformed values become undefined.
 */
export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return undefined;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
