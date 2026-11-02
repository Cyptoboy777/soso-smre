/** In-memory token bucket per IP/route.
 * Soft per-instance guard (Vercel may have many isolates).
 * Still useful against casual abuse; pair with notional caps on trade.
 */
type Bucket = { tokens: number; updated: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000): { ok: boolean; remaining: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.updated > windowMs) {
    b = { tokens: limit, updated: now };
  }
  // refill
  const elapsed = now - b.updated;
  if (elapsed > 0) {
    b.tokens = Math.min(limit, b.tokens + (elapsed / windowMs) * limit);
    b.updated = now;
  }
  if (b.tokens < 1) {
    buckets.set(key, b);
    return { ok: false, remaining: 0 };
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return { ok: true, remaining: Math.floor(b.tokens) };
}
