import { NextResponse } from 'next/server';
import { hitRate, listTrackRecord, resolveOpen } from '@/lib/track-record';
import { fetchSpotTickers } from '@/lib/sodex';

export const dynamic = 'force-dynamic';

export async function GET() {
  let marks: Record<string, number> = {};
  let marksSource: unknown = null;
  try {
    const market = await fetchSpotTickers();
    for (const t of market.tickers) marks[t.symbol] = t.lastPrice;
    marksSource = market.meta;
  } catch (e) {
    console.warn('[track-record] tickers failed', e);
  }
  const rows = Object.keys(marks).length ? resolveOpen(marks) : listTrackRecord();
  const stats = hitRate(rows);
  return NextResponse.json({
    stats,
    entries: rows,
    marksSource,
  });
}
