import { NextRequest, NextResponse } from 'next/server';
import { fetchAllTickers, fetchMarketBundle } from '@/lib/sodex-market';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(`sodex-market:${ip}`, 90, 60_000, 'Rate limit exceeded');
  if (limited) return limited;

  const list = req.nextUrl.searchParams.get('list');
  if (list === 'tickers') {
    const { tickers, gateway } = await fetchAllTickers();
    return NextResponse.json(
      { tickers, gateway, label: 'Live prices' },
      { headers: { 'Cache-Control': 's-maxage=5, stale-while-revalidate=15' } },
    );
  }

  const symbol = req.nextUrl.searchParams.get('symbol') || 'vBTC_vUSDC';
  if (!/^v?[A-Z0-9]+_v?[A-Z0-9]+$/i.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }
  const intervalRaw = req.nextUrl.searchParams.get('interval') || '1h';
  const interval = INTERVALS.has(intervalRaw) ? intervalRaw : '1h';
  const bundle = await fetchMarketBundle(symbol, interval);
  return NextResponse.json(bundle, {
    headers: { 'Cache-Control': 's-maxage=5, stale-while-revalidate=15' },
  });
}
