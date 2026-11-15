import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side SoSoValue proxy. SOSOVALUE_API_KEY lives only in the server environment and is
 * attached here; it is never sent to the browser. Only the read-only endpoints below are exposed
 * and responses are cached at the edge so visitors do not burn through your API quota.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = 'https://openapi.sosovalue.com/openapi/v1';
const ALLOWED: Record<string, { ttl: number; params: string[] }> = {
  'news/hot': { ttl: 120, params: [] },
  'etfs/summary-history': { ttl: 600, params: ['symbol', 'country_code', 'limit'] },
  'currencies/sector-spotlight': { ttl: 300, params: [] },
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const key = process.env.SOSOVALUE_API_KEY;
  const path = (await ctx.params).path.join('/');
  const rule = ALLOWED[path];
  if (!rule) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!key) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const qs = new URLSearchParams();
  for (const p of rule.params) {
    const v = req.nextUrl.searchParams.get(p);
    if (v && /^[A-Za-z0-9_-]{1,16}$/.test(v)) qs.set(p, v);
  }
  try {
    const upstream = await fetch(`${BASE}/${path}${qs.size ? '?' + qs : ''}`, {
      headers: { 'x-soso-api-key': key, accept: 'application/json' },
      next: { revalidate: rule.ttl },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await upstream.text();
    if (!upstream.ok) return NextResponse.json({ error: `upstream_${upstream.status}` }, { status: 502 });
    return new NextResponse(text, { headers: { 'content-type': 'application/json', 'cache-control': `public, s-maxage=${rule.ttl}, stale-while-revalidate=${rule.ttl * 3}` } });
  } catch {
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 });
  }
}
