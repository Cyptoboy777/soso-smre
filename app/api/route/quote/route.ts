import { NextResponse } from 'next/server';
import { getNormalizedQuote, readFeeEnv } from '@/lib/routes/quote';
import { rateLimit } from '@/lib/rate-limit';
import { FRIENDLY_RATE } from '@/lib/routes/types';
import { validateQuoteBody } from '@/lib/routes/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (await rateLimit(req, 'route-quote', 20)) {
    return NextResponse.json({ error: FRIENDLY_RATE }, { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'That request is not valid. Check the token, chain and amount.' }, { status: 400 }); }
  const checked = validateQuoteBody(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status });
  const fee = readFeeEnv(process.env);
  const result = await getNormalizedQuote(checked.value, {
    fetch,
    relayApiKey: process.env.RELAY_API_KEY,
    feeBps: fee.bps,
    feeRecipient: fee.recipient,
    timeoutMs: 10_000,
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result);
}
