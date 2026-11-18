/** In-memory per-IP rate limiter for the quote route (20 requests / 60s). */
const WINDOW_MS = 60_000;
const MAX = 20;
const hits = new Map<string, number[]>();

export function allowRequest(ip: string, now = Date.now()): boolean {
  const key = ip || 'unknown';
  const prev = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (prev.length >= MAX) {
    hits.set(key, prev);
    return false;
  }
  prev.push(now);
  hits.set(key, prev);
  return true;
}

/** Client IP from headers a visitor cannot forge: the platform's own headers first, then the LAST x-forwarded-for entry (never the first, which the client controls). */
export function clientIp(req: Request): string {
  const platform = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim();
  if (platform) return platform.slice(0, 64);
  const parts = (req.headers.get('x-forwarded-for') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return (parts.length ? parts[parts.length - 1] : 'unknown').slice(0, 64);
}

/** Test-only: drop recorded hits. */
export function resetRateLimit() {
  hits.clear();
}
