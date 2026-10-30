import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { fetchHotNews } from '@/lib/sosovalue';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  const rl = rateLimit(`soso:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit: SoSoValue allows ~20 calls/min' }, { status: 429 });
  }
  const panel = await fetchHotNews();
  return NextResponse.json(panel);
}
