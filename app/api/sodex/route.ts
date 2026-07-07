import { NextResponse } from 'next/server';
import { checkRateLimit, getClientKey } from '@/lib/rateLimit';

// Explicit allowlist — the endpoint query param used to be concatenated straight
// into the upstream URL with no validation, letting any caller ride our server
// to hit arbitrary paths on the SoDEX host.
const ALLOWED_ENDPOINTS = new Set([
  'spot/markets/tickers24hr',
  'perps/markets/tickers24hr',
  'perps/markets/mark-prices',
  'spot/markets/symbols',
  'perps/markets/symbols',
]);

export async function GET(request: Request) {
  const rl = checkRateLimit(`sodex:${getClientKey(request)}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please slow down.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
  }

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json({ error: 'Endpoint not allowed' }, { status: 400 });
  }

  const baseUrl = 'https://mainnet-gw.sodex.dev/api/v1';
  let revalidate = 0;

  if (endpoint === 'spot/markets/tickers24hr' || endpoint === 'perps/markets/tickers24hr') {
    revalidate = 15;
  } else if (endpoint === 'perps/markets/mark-prices') {
    revalidate = 10;
  } else if (endpoint === 'spot/markets/symbols' || endpoint === 'perps/markets/symbols') {
    revalidate = 300;
  } else {
    revalidate = 60;
  }

  try {
    const res = await fetch(`${baseUrl}/${endpoint}`, {
      next: { revalidate }
    });

    if (!res.ok) {
      throw new Error(`SoDEX API responded with ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('SoDEX API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 502 });
  }
}
