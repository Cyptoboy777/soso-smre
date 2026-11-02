import { NextResponse } from 'next/server';
import { hitRate, listTrackRecord, resolveOpen } from '@/lib/track-record';
import { fetchSpotTickers } from '@/lib/sodex';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(`track:${ip}`, 30, 60_000, 'Rate limit exceeded');
  if (limited) return limited;

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
