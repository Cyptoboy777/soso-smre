import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin pass-through to the public SoDEX gateway (avoids browser CORS limits).
 * - Only /api/v1/spot/**, GET/POST /api/v1/user/<address>/api-keys and GET/POST /api/v1/user/<address>/builders are reachable (no open proxy).
 * - Users' own API-key signature headers are forwarded untouched and never logged or stored.
 * - No secret of this deployment is involved: SoDEX market data needs no key.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const HOSTS: Record<string, string> = {
  mainnet: 'https://mainnet-gw.sodex.dev',
  testnet: 'https://testnet-gw.sodex.dev',
};
const FORWARD_HEADERS = ['content-type', 'accept', 'x-api-key', 'x-api-sign', 'x-api-nonce', 'x-api-chain'];
const MAX_BODY = 32 * 1024;

// best-effort per-IP limiter (in memory per serverless instance); signed calls are far stricter than reads
const hits = new Map<string, number[]>();
function limited(ip: string, bucket: string, max: number) {
  const now = Date.now(), k = `${bucket}:${ip}`;
  const recent = (hits.get(k) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(k, recent);
  if (hits.size > 5000) for (const [key, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(key);
  return recent.length > max;
}

const SPOT = /^api\/v1\/spot\/[A-Za-z0-9_\-./]+$/;
const KEYREG = /^api\/v1\/user\/0x[0-9a-fA-F]{40}\/api-keys$/;
const BUILDERS = /^api\/v1\/user\/0x[0-9a-fA-F]{40}\/builders$/; // builder-fee approval (GET status, POST signed approval)

function cacheFor(path: string, method: string): string {
  if (method !== 'GET') return 'no-store';
  if (/^api\/v1\/spot\/markets\/(symbols|coins)$/.test(path)) return 'public, s-maxage=300, stale-while-revalidate=900';
  if (/^api\/v1\/spot\/markets\/(tickers|[^/]+\/(orderbook|trades|klines))$/.test(path)) return 'public, s-maxage=2, stale-while-revalidate=6';
  return 'no-store'; // account data is per-user
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const [net, ...rest] = (await ctx.params).path;
  const host = HOSTS[net];
  const path = rest.join('/');
  const method = req.method;
  const allowed = SPOT.test(path) || ((method === 'GET' || method === 'POST') && KEYREG.test(path)) || ((method === 'GET' || method === 'POST') && BUILDERS.test(path));
  if (!host || !allowed || path.includes('..')) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  if (limited(ip, method === 'GET' ? 'r' : 'w', method === 'GET' ? 900 : 60)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const headers: Record<string, string> = {};
  for (const h of FORWARD_HEADERS) { const v = req.headers.get(h); if (v) headers[h] = v; }

  let body: string | undefined;
  if (method !== 'GET') {
    body = await req.text();
    if (body.length > MAX_BODY) return NextResponse.json({ error: 'Body too large.' }, { status: 413 });
  }

  try {
    const upstream = await fetch(`${host}/${path}${req.nextUrl.search}`, { method, headers, body, cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'cache-control': upstream.ok ? cacheFor(path, method) : 'no-store' },
    });
  } catch {
    return NextResponse.json({ code: -1, error: 'SoDEX gateway did not answer.' }, { status: 502 });
  }
}

export { handle as GET, handle as POST, handle as DELETE };
