import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      "https://api.sodex.xyz/api/v1/spot/markets/tickers",
      { next: { revalidate: 10 } }
    );

    if (!response.ok) {
      throw new Error(`SoDEX API responded with ${response.status}`);
    }

    const data = await response.json();
    // Wrap in object if it's a direct array to stay consistent with other APIs
    return NextResponse.json(data);
  } catch (error) {
    console.error('SoDEX Tickers API Error:', error);
    return NextResponse.json({
      error: "Failed to fetch SoDEX market data",
    }, { status: 502 });
  }
}
