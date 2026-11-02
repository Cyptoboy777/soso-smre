import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketBundle } from '@/lib/sodex-market';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(`sodex-market:${ip}`, 40, 60_000, 'Rate limit exceeded');
  if (limited) return limited;

  const symbol = req.nextUrl.searchParams.get('symbol') || 'vBTC_vUSDC';
  if (!/^v?[A-Z0-9]+_v?[A-Z0-9]+$/i.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }
  const bundle = await fetchMarketBundle(symbol);
  return NextResponse.json(bundle, {
    headers: { 'Cache-Control': 's-maxage=15, stale-while-revalidate=30' },
  });
}
