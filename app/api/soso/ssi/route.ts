import { NextResponse } from 'next/server';
import { fetchSsiSnapshot } from '@/lib/sosovalue';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker') ?? 'ssimag7';
  const panel = await fetchSsiSnapshot(ticker);
  return NextResponse.json(panel);
}
