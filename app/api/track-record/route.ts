import { NextResponse } from 'next/server';
import { hitRate, listTrackRecord, resolveOpen } from '@/lib/track-record';
import { fetchSpotTickers } from '@/lib/sodex';

export const dynamic = 'force-dynamic';

export async function GET() {
  const market = await fetchSpotTickers();
  const marks: Record<string, number> = {};
  for (const t of market.tickers) marks[t.symbol] = t.lastPrice;
  const rows = resolveOpen(marks);
  const stats = hitRate(rows);
  return NextResponse.json({
    stats,
    entries: rows,
    marksSource: market.meta,
  });
}
