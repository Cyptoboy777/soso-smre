import { NextResponse } from 'next/server';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';
import { fetchHotNews } from '@/lib/sosovalue';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rejectIfRateLimited(
    `soso:${clientIp(req)}`,
    20,
    60_000,
    'Rate limit: SoSoValue allows ~20 calls/min',
  );
  if (limited) return limited;
  const panel = await fetchHotNews();
  return NextResponse.json(panel);
}
