import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getNormalizedStatus } from '@/lib/routes/quote';
import { FRIENDLY_RATE } from '@/lib/routes/types';
import { validateRequestId, validateTxHash } from '@/lib/routes/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Every call can spend the Relay API key quota, so cap it per visitor (the page polls with backoff, well under this).
  if (await rateLimit(req, 'route-status', 40)) {
    return NextResponse.json({ error: FRIENDLY_RATE }, { status: 429 });
  }
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider');
  const requestId = url.searchParams.get('requestId');
  const txHash = url.searchParams.get('txHash');
  const fromChain = Number(url.searchParams.get('fromChain') ?? '');
  const toChain = Number(url.searchParams.get('toChain') ?? '');
  if (provider !== 'relay' && provider !== 'lifi') {
    return NextResponse.json({ error: 'Could not check that route right now.' }, { status: 400 });
  }
  const id = provider === 'relay' ? requestId : txHash;
  if (provider === 'relay' && !validateRequestId(id)) {
    return NextResponse.json({ error: 'Could not check that route right now.' }, { status: 400 });
  }
  if (provider === 'lifi' && !validateTxHash(id)) {
    return NextResponse.json({ error: 'Could not check that route right now.' }, { status: 400 });
  }
  const result = await getNormalizedStatus({
    provider,
    id: id!,
    fromChain: Number.isFinite(fromChain) ? fromChain : undefined,
    toChain: Number.isFinite(toChain) ? toChain : undefined,
  }, { fetch, relayApiKey: process.env.RELAY_API_KEY, timeoutMs: 10_000 });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result);
}
