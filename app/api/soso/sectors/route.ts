import { NextResponse } from 'next/server';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';
import { fetchSectorSpotlight } from '@/lib/sosovalue';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rejectIfRateLimited(
    `soso:${clientIp(req)}`,
    20,
    60_000,
    'Too many requests. Please wait a minute and try again.',
  );
  if (limited) return limited;
  const panel = await fetchSectorSpotlight();
  return NextResponse.json(panel);
}
