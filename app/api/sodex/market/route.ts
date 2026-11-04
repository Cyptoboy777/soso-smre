import { NextRequest, NextResponse } from 'next/server';
import { fetchAllTickers, fetchMarketBundle } from '@/lib/sodex-market';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);

function publicTicker(t: {
  symbol: string;
  lastPrice: number;
  changePct24h: number;
  high: number;
  low: number;
  volume: number;
}) {
  return {
    symbol: t.symbol,
    lastPrice: t.lastPrice,
    changePct24h: t.changePct24h,
    high: t.high,
    low: t.low,
    volume: t.volume,
  };
}

function publicBundle(bundle: Awaited<ReturnType<typeof fetchMarketBundle>>) {
  const book = bundle.orderbook
    ? {
        symbol: bundle.orderbook.symbol,
        bids: bundle.orderbook.bids,
        asks: bundle.orderbook.asks,
        blockTime: bundle.orderbook.blockTime,
        updateId: bundle.orderbook.updateId,
        meta: {
          source: bundle.orderbook.meta?.source,
          fetchedAt: bundle.orderbook.meta?.fetchedAt,
        },
      }
    : null;
  return {
    ticker: bundle.ticker
      ? {
          symbol: bundle.ticker.symbol,
          lastPrice: bundle.ticker.lastPrice,
          changePct24h: bundle.ticker.changePct24h,
          high: bundle.ticker.high,
          low: bundle.ticker.low,
          volume: bundle.ticker.volume,
        }
      : null,
    orderbook: book,
    klines: bundle.klines,
    trades: (bundle.trades ?? []).map((tr) => ({
      price: tr.price,
      qty: tr.qty,
      side: tr.side,
      time: tr.time,
    })),
    fundingRate: bundle.fundingRate,
    meta: {
      source: bundle.meta?.source,
      fetchedAt: bundle.meta?.fetchedAt,
      note: 'Live prices',
    },
    label: 'Live prices',
    practiceMode: true,
  };
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(`sodex-market:${ip}`, 90, 60_000, 'Rate limit exceeded');
  if (limited) return limited;

  const list = req.nextUrl.searchParams.get('list');
  if (list === 'tickers') {
    const { tickers } = await fetchAllTickers();
    return NextResponse.json(
      { tickers: tickers.map(publicTicker), label: 'Live prices', practiceMode: true },
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
  return NextResponse.json(publicBundle(bundle), {
    headers: { 'Cache-Control': 's-maxage=5, stale-while-revalidate=15' },
  });
}
