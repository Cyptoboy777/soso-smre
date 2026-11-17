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

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return (req.headers.get('x-real-ip') ?? 'unknown').slice(0, 64);
}

/** Test-only: drop recorded hits. */
export function resetRateLimit() {
  hits.clear();
}
