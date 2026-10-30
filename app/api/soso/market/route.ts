import { NextResponse } from 'next/server';
import { fetchSpotTickers } from '@/lib/sodex';

export const dynamic = 'force-dynamic';

export async function GET() {
  const panel = await fetchSpotTickers();
  return NextResponse.json(panel);
}
