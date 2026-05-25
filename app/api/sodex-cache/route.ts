import { NextResponse } from 'next/server';
import type { Ticker } from '@/types/sodex';

// In-memory cache — survives for the life of the serverless instance
// Vercel re-creates instances on cold start; local dev keeps it alive

declare global {
  // eslint-disable-next-line no-var
  var __sodexTickerCache: { tickers: Ticker[]; updatedAt: number } | undefined;
}

// POST — browser SoDEX WS bridge pushes live tickers here
export async function POST(req: Request) {
  try {
    const body = await req.json() as { tickers: Ticker[] };
    if (!Array.isArray(body.tickers) || body.tickers.length === 0) {
      return NextResponse.json({ ok: false, error: 'No tickers provided' }, { status: 400 });
    }
    // Store in global (survives HMR in dev, shared across requests in same instance)
    globalThis.__sodexTickerCache = { tickers: body.tickers, updatedAt: Date.now() };
    return NextResponse.json({ ok: true, count: body.tickers.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// GET — /api/prices reads this cache
export async function GET() {
  const cache = globalThis.__sodexTickerCache;
  if (!cache || cache.tickers.length === 0) {
    return NextResponse.json({ ok: false, tickers: [], stale: true }, { status: 204 });
  }
  // Return in same shape as /api/prices for easy compatibility
  const prices = cache.tickers.map(t => ({
    symbol: `${t.base}USDT`,   // normalise back to XXXUSDT for existing UI
    price:  t.lastPrice.toFixed(t.lastPrice >= 1 ? 2 : 6),
    change: t.priceChangePct.toFixed(2),
    volume: t.quoteVolume.toFixed(0),
    high:   t.high.toFixed(2),
    low:    t.low.toFixed(2),
    rawPrice: t.lastPrice,
  }));
  return NextResponse.json({ ok: true, tickers: cache.tickers, prices, updatedAt: cache.updatedAt });
}
