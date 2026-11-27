import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitLocal } from '@/lib/rate-limit';

/**
 * Same-origin pass-through to the public SoDEX gateway (avoids browser CORS limits).
 * - Only the exact spot endpoints the app uses (method + path allowlist below, no wildcard), GET /api/v1/perps/accounts/<address>/(balances|state), GET /api/v1/perps/markets/(coins|symbols|tickers|<symbol>/klines|<symbol>/orderbook), POST/DELETE /api/v1/perps/trade/orders, POST /api/v1/perps/trade/orders/modify, POST /api/v1/perps/trade/leverage, POST /api/v1/perps/accounts/transfers, GET/POST /api/v1/user/<address>/api-keys and GET/POST /api/v1/user/<address>/builders are reachable (no open proxy).
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
const FORWARD_HEADERS = ['content-type', 'accept', 'authorization', 'x-api-key', 'x-api-sign', 'x-api-nonce', 'x-api-chain'];
const MAX_BODY = 32 * 1024;

// Spot: exact endpoints only. Reads are public market data and address-only account reads; writes are user-signed trading actions.
const SYM = '[A-Za-z0-9_-]{1,40}';
const ADDR = '0x[0-9a-fA-F]{40}';
const SPOT_GET = new RegExp(`^api/v1/spot/(markets/(symbols|coins|tickers)|markets/${SYM}/(orderbook|klines|trades)|accounts/${ADDR}/(state|balances|orders|orders/history|trades|dcas|twaps))$`);
const SPOT_POST = /^api\/v1\/spot\/trade\/(orders\/batch|orders\/schedule-cancel|twaps|dcas)$/;
const SPOT_DELETE = /^api\/v1\/spot\/trade\/(orders\/batch|twaps|dcas)$/;
const PERPS_READ = /^api\/v1\/perps\/accounts\/0x[0-9a-fA-F]{40}\/(balances|state)$/; // public, address-only reads
const PERPS_COINS = /^api\/v1\/perps\/markets\/coins$/; // public coin precision for transfer flooring
const PERPS_TRANSFER = /^api\/v1\/perps\/accounts\/transfers$/; // user-signed Move to Spot only
const PERPS_MARKET = /^api\/v1\/perps\/markets\/(symbols|tickers|[A-Za-z0-9_-]{1,40}\/(klines|orderbook))$/; // public perps market data
const PERPS_ORDERS = /^api\/v1\/perps\/trade\/orders$/; // user-signed perps orders (POST place, DELETE cancel)
const PERPS_MODIFY = /^api\/v1\/perps\/trade\/orders\/modify$/; // user-signed change of a resting TP/SL trigger
const PERPS_LEVERAGE = /^api\/v1\/perps\/trade\/leverage$/; // user-signed leverage update
const KEYREG = /^api\/v1\/user\/0x[0-9a-fA-F]{40}\/api-keys$/;
const BUILDERS = /^api\/v1\/user\/0x[0-9a-fA-F]{40}\/builders$/; // builder-fee approval (GET status, POST signed approval)
const REWARDS_AUTH = /^api\/v1\/auth\/(nonce|verify)$/;
const REWARDS_PUBLIC = /^api\/v1\/(lottery\/(meta|feed|draw\/entries)|sopoints\/(week\/info|volume-weights))$/;
const REWARDS_PRIVATE_GET = /^api\/v1\/(lottery\/(treasures|boxes|box\/sign-params|job\/[0-9]+|jobs|ledger|history|pfps)|sopoints\/(summary|week\/list))$/;
const REWARDS_PRIVATE_POST = /^api\/v1\/(lottery\/(treasure\/open|box\/(open|merge)))$/;

function cacheFor(path: string, method: string): string {
  if (method !== 'GET') return 'no-store';
  if (/^api\/v1\/spot\/markets\/(symbols|coins)$/.test(path)) return 'public, s-maxage=300, stale-while-revalidate=900';
  if (/^api\/v1\/perps\/markets\/symbols$/.test(path)) return 'public, s-maxage=300, stale-while-revalidate=900';
  if (/^api\/v1\/perps\/markets\/(tickers|[^/]+\/(orderbook|klines))$/.test(path)) return 'public, s-maxage=2, stale-while-revalidate=6';
  if (/^api\/v1\/spot\/markets\/(tickers|[^/]+\/(orderbook|trades|klines))$/.test(path)) return 'public, s-maxage=2, stale-while-revalidate=6';
  return 'no-store'; // account data (spot + perps balances/state) is per-user
}

/** State-changing calls must come from this site. Browsers always send Origin on cross-site POST/DELETE, so another website cannot drive this proxy. No wildcard CORS headers are ever set. */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return req.method === 'GET'; // plain same-origin GETs may omit it; writes must carry it
  try { return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host')); } catch { return false; }
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const [net, ...rest] = (await ctx.params).path;
  const host = HOSTS[net];
  const path = rest.join('/');
  const method = req.method;
  const allowed = (method === 'GET' && SPOT_GET.test(path)) || (method === 'POST' && SPOT_POST.test(path)) || (method === 'DELETE' && SPOT_DELETE.test(path)) || (method === 'GET' && PERPS_READ.test(path)) || (method === 'GET' && PERPS_COINS.test(path)) || (method === 'POST' && PERPS_TRANSFER.test(path)) || (method === 'GET' && PERPS_MARKET.test(path)) || ((method === 'POST' || method === 'DELETE') && PERPS_ORDERS.test(path)) || (method === 'POST' && PERPS_LEVERAGE.test(path)) || (method === 'POST' && PERPS_MODIFY.test(path)) || ((method === 'GET' || method === 'POST') && KEYREG.test(path)) || ((method === 'GET' || method === 'POST') && BUILDERS.test(path)) || ((method === 'GET' || method === 'POST') && REWARDS_AUTH.test(path)) || (method === 'GET' && (REWARDS_PUBLIC.test(path) || REWARDS_PRIVATE_GET.test(path))) || (method === 'POST' && REWARDS_PRIVATE_POST.test(path));
  if (!host || !allowed || path.includes('..')) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  if (method !== 'GET' && !sameOrigin(req)) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });

  if (req.nextUrl.search.length > 512) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  // Public reads: cheap per-instance counter (no network hop). Signed writes: shared counter so cold starts cannot reset it.
  const over = method === 'GET' ? rateLimitLocal(req, 'sodex-r', 900) : await rateLimit(req, 'sodex-w', 60);
  if (over) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

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
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'cross-origin-resource-policy': 'same-origin', 'cache-control': upstream.ok ? cacheFor(path, method) : 'no-store' },
    });
  } catch {
    return NextResponse.json({ code: -1, error: 'SoDEX gateway did not answer.' }, { status: 502 });
  }
}

export { handle as GET, handle as POST, handle as DELETE };
