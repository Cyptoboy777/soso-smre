import { NextResponse } from 'next/server';
import { evaluateRisk, DEFAULT_RISK_PARAMS } from '@/lib/risk-engine';
import type { NewsPanel, Thesis } from '@/types/flow';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json()) as {
    thesis: Thesis;
    news: NewsPanel;
    params?: Partial<typeof DEFAULT_RISK_PARAMS>;
  };
  if (!body.thesis || !body.news) {
    return NextResponse.json({ error: 'thesis and news required' }, { status: 400 });
  }
  const decision = evaluateRisk(body.thesis, body.news, body.params);
  return NextResponse.json(decision);
}
