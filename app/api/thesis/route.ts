import { NextResponse } from 'next/server';
import { fetchEtfFlows, fetchHotNews, fetchSsiSnapshot } from '@/lib/sosovalue';
import { fetchSpotTickers } from '@/lib/sodex';
import { generateThesis } from '@/lib/thesis';
import { evaluateRisk } from '@/lib/risk-engine';
import { logIdea } from '@/lib/track-record';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const persist = url.searchParams.get('persist') === '1';

  const [etfBtc, etfEth, news, ssi, market] = await Promise.all([
    fetchEtfFlows('BTC'),
    fetchEtfFlows('ETH'),
    fetchHotNews(),
    fetchSsiSnapshot('ssimag7'),
    fetchSpotTickers(),
  ]);

  const thesis = await generateThesis({ etfBtc, etfEth, news, ssi, market });
  const risk = evaluateRisk(thesis, news);

  let trackId: string | undefined;
  if (persist && thesis.side !== 'FLAT') {
    const row = logIdea(thesis, 'idea-only');
    trackId = row.id;
  }

  return NextResponse.json({
    etfBtc,
    etfEth,
    news,
    ssi,
    market,
    thesis,
    risk,
    trackId,
    demoMode: process.env.FLOWSENTINEL_DEMO_MODE === '1' || !process.env.SOSOVALUE_API_KEY,
    keys: {
      sosovalue: Boolean(process.env.SOSOVALUE_API_KEY?.trim()),
      gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
      sodex: Boolean(process.env.SODEX_API_KEY?.trim() && process.env.SODEX_API_SECRET?.trim()),
    },
  });
}
