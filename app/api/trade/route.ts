import { NextResponse } from 'next/server';
import { placeLimitOrder, querySpotOrder } from '@/lib/sodex';
import { evaluateRisk } from '@/lib/risk-engine';
import { logIdea, updateOrderStatus } from '@/lib/track-record';
import type { NewsPanel, Thesis } from '@/types/flow';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json()) as {
    thesis: Thesis;
    news: NewsPanel;
    confirmed: boolean;
    quantity?: number;
  };

  if (!body.thesis || !body.news) {
    return NextResponse.json({ error: 'thesis and news required' }, { status: 400 });
  }
  if (!body.confirmed) {
    return NextResponse.json({ error: 'Explicit confirmation required' }, { status: 400 });
  }

  const risk = evaluateRisk(body.thesis, body.news);
  if (!risk.approved) {
    return NextResponse.json(
      { error: 'Risk gate blocked this order', risk },
      { status: 403 },
    );
  }

  const side = body.thesis.side === 'SHORT' ? 'SELL' : 'BUY';
  const quantity = body.quantity && body.quantity > 0 ? body.quantity : risk.positionSize;

  const order = await placeLimitOrder({
    thesisId: body.thesis.id,
    symbol: body.thesis.symbol,
    side,
    price: body.thesis.entry,
    quantity,
    confirmed: true,
  });

  const row = logIdea(body.thesis, order.mode === 'live' ? 'live' : 'dry-run', order.orderId);
  let queried: { status?: string; ok?: boolean } | null = null;
  if (order.mode === 'live' && order.orderId) {
    queried = await querySpotOrder(order.orderId);
    if (queried.ok && queried.status) {
      updateOrderStatus(row.id, queried.status);
    }
  }

  return NextResponse.json({ order, risk, trackId: row.id, queried, modeLabel: order.mode === 'live' ? 'TESTNET_LIVE' : 'DRY_RUN_SIMULATED' });
}
