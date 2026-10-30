import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/sosovalue';

export const dynamic = 'force-dynamic';

export async function GET() {
  const panel = await fetchHotNews();
  return NextResponse.json(panel);
}
