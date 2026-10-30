import { NextResponse } from 'next/server';
import { fetchEtfFlows, fetchHotNews, fetchSsiSnapshot, hasSosoKey } from '@/lib/sosovalue';
import { fetchSpotTickers, hasSodexCredentials } from '@/lib/sodex';
import { generateThesis, hasGeminiKey } from '@/lib/thesis';
import { evaluateRisk } from '@/lib/risk-engine';
import { buildJarvisBriefing } from '@/lib/jarvis';
import type { DeskSnapshot } from '@/types/flow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [etfBtc, etfEth, news, ssi, market] = await Promise.all([
    fetchEtfFlows('BTC'),
    fetchEtfFlows('ETH'),
    fetchHotNews(),
    fetchSsiSnapshot(),
    fetchSpotTickers(),
  ]);
  const thesis = await generateThesis({ etfBtc, etfEth, news, ssi, market });
  const risk = evaluateRisk(thesis, news);
  const desk: DeskSnapshot = {
    etfBtc,
    etfEth,
    news,
    ssi,
    market,
    thesis,
    risk,
    demoMode: !hasSosoKey(),
  };
  const briefing = await buildJarvisBriefing(desk);
  return NextResponse.json({
    briefing,
    desk,
    keys: {
      sosovalue: hasSosoKey(),
      gemini: hasGeminiKey(),
      sodex: hasSodexCredentials(),
    },
  });
}
