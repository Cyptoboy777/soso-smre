import { NextResponse } from 'next/server';
import { cancelSpotOrder, hasSodexCredentials } from '@/lib/sodex';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `sodex-cancel:${ip}`,
    10,
    60 * 60_000,
    'Rate limit: max 10 cancel attempts per hour from this IP',
  );
  if (limited) return limited;

  if (!hasSodexCredentials()) {
    return NextResponse.json({ error: 'SoDEX credentials missing' }, { status: 503 });
  }
  const body = (await req.json()) as {
    symbol?: string;
    orderId?: string;
    origClOrdID?: string;
    confirmed?: boolean;
  };
  if (!body.confirmed) {
    return NextResponse.json({ error: 'confirmed required' }, { status: 400 });
  }
  if (!body.orderId || !body.symbol) {
    return NextResponse.json({ error: 'symbol and orderId required' }, { status: 400 });
  }
  const result = await cancelSpotOrder({
    symbol: body.symbol,
    orderId: body.orderId,
    origClOrdID: body.origClOrdID,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
