import { NextResponse } from 'next/server';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';
import { fetchSpotTickers } from '@/lib/sodex';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rejectIfRateLimited(
    `soso:${clientIp(req)}`,
    20,
    60_000,
    'Rate limit: SoSoValue allows ~20 calls/min',
  );
  if (limited) return limited;
  const panel = await fetchSpotTickers();
  return NextResponse.json(panel);
}
