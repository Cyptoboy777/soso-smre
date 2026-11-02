import { NextResponse } from 'next/server';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';
import { fetchSsiSnapshot } from '@/lib/sosovalue';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rejectIfRateLimited(
    `soso:${clientIp(req)}`,
    20,
    60_000,
    'Rate limit: SoSoValue allows ~20 calls/min',
  );
  if (limited) return limited;
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker') ?? 'ssimag7';
  const panel = await fetchSsiSnapshot(ticker);
  return NextResponse.json(panel);
}
