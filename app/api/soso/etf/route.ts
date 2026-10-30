import { NextResponse } from 'next/server';
import { fetchEtfFlows } from '@/lib/sosovalue';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') ?? 'BTC').toUpperCase() === 'ETH' ? 'ETH' : 'BTC';
  const panel = await fetchEtfFlows(symbol);
  return NextResponse.json(panel);
}
