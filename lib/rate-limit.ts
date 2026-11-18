/**
 * Shared server-side abuse guards for the public /api routes.
 *
 * - clientIp: only headers a visitor cannot forge (never the FIRST x-forwarded-for entry, which the client controls).
 * - rateLimit / budget: a shared counter in Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set
 *   (survives cold starts and is shared by every serverless instance); otherwise, or if Redis is unreachable,
 *   a per-instance in-memory counter so the routes keep working and stay limited.
 * - sameOrigin: refuses browser requests that come from another website.
 *
 * Self-contained on purpose (no app imports) so it can be unit-tested with plain Node.
 */

type HeaderBag = { headers: { get(name: string): string | null } };

export function clientIp(req: HeaderBag): string {
  const h = req.headers;
  // Set by the platform and overwritten on every request, so a visitor cannot choose them (Vercel).
  const platform = h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim();
  if (platform) return platform.slice(0, 64);
  // Fallback: the LAST x-forwarded-for entry is the one appended by the nearest proxy.
  const parts = (h.get('x-forwarded-for') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return (parts.length ? parts[parts.length - 1] : 'unknown').slice(0, 64);
}

const memory = new Map<string, { start: number; count: number }>();

function memoryHit(key: string, windowMs: number): number {
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || now - cur.start >= windowMs) {
    memory.set(key, { start: now, count: 1 });
    if (memory.size > 10_000) for (const [k, v] of memory) if (now - v.start >= windowMs) memory.delete(k);
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

/** One INCR (+ expiry on first hit) against Upstash Redis over REST. null = not configured / unreachable. */
async function durableHit(key: string, windowMs: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['PEXPIRE', key, String(windowMs), 'NX']]),
      cache: 'no-store',
      signal: AbortSignal.timeout(1_500),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ result?: unknown }>;
    const n = Number(json?.[0]?.result);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** True when this caller is over `limit` hits per window for `bucket`. */
export async function rateLimit(req: HeaderBag, bucket: string, limit: number, windowMs = 60_000): Promise<boolean> {
  const key = `rl:${bucket}:${clientIp(req)}`;
  return ((await durableHit(key, windowMs)) ?? memoryHit(key, windowMs)) > limit;
}

/** In-memory only variant for cheap, high-volume public reads (no network round trip). */
export function rateLimitLocal(req: HeaderBag, bucket: string, limit: number, windowMs = 60_000): boolean {
  return memoryHit(`rl:${bucket}:${clientIp(req)}`, windowMs) > limit;
}

/** One shared counter for the whole app (for example a daily AI budget). True when the budget is used up. */
export async function budgetExceeded(bucket: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `budget:${bucket}`;
  return ((await durableHit(key, windowMs)) ?? memoryHit(key, windowMs)) > limit;
}

/**
 * Browsers label every request with Sec-Fetch-Site, and it cannot be forged by a web page: trust it first.
 * Older browsers and non-browser clients fall back to comparing Origin with the host(s) this request was addressed to.
 * Requests with neither header (curl, servers) are allowed here and are still bounded by the limiters.
 */
export function sameOrigin(req: HeaderBag): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const hosts = [req.headers.get('host'), ...(req.headers.get('x-forwarded-host') ?? '').split(',')].map((h) => (h ?? '').trim().toLowerCase()).filter(Boolean);
  try { return hosts.includes(new URL(origin).host.toLowerCase()); } catch { return false; }
}

const DAY = 86_400_000;

/**
 * Gate for every route that spends AI quota. Returns an error to send back, or null when the request may proceed.
 * Order: cheap checks first, then per-visitor minute cap, per-visitor daily cap, then one shared daily budget
 * (AI_DAILY_CAP, default 1500) so a flood of fresh IPs still cannot drain the provider quota.
 */
export async function aiGate(
  req: HeaderBag,
  route: string,
  caps: { perMinute: number; perDay: number },
): Promise<{ status: number; error: string } | null> {
  if (!sameOrigin(req)) return { status: 403, error: 'Request not allowed.' };
  if (await rateLimit(req, `${route}:min`, caps.perMinute)) return { status: 429, error: 'Too many requests. Please wait a minute and try again.' };
  if (await rateLimit(req, `${route}:day`, caps.perDay, DAY)) return { status: 429, error: 'Daily limit reached for this assistant. Please try again tomorrow.' };
  const cap = Math.max(1, Number(process.env.AI_DAILY_CAP) || 1500);
  if (await budgetExceeded('ai-global', cap, DAY)) return { status: 429, error: 'The AI assistant is paused for today. Please try again tomorrow.' };
  return null;
}

/** Reject oversized bodies before parsing them. */
export function tooLarge(req: HeaderBag, maxBytes: number): boolean {
  const n = Number(req.headers.get('content-length') ?? 0);
  return Number.isFinite(n) && n > maxBytes;
}
