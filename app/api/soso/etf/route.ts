import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { fetchEtfFlows } from '@/lib/sosovalue';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  const rl = rateLimit(`soso:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit: SoSoValue allows ~20 calls/min' }, { status: 429 });
  }
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') ?? 'BTC').toUpperCase() === 'ETH' ? 'ETH' : 'BTC';
  const panel = await fetchEtfFlows(symbol);
  return NextResponse.json(panel);
}
