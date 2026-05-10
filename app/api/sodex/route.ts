import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
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
