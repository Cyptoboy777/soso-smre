import { NextResponse } from 'next/server';
import {
  placeLimitOrder,
  querySpotOrder,
  hasSodexCredentials,
  SODEX_MAX_NOTIONAL_USDC,
} from '@/lib/sodex';
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
  let quantity = body.quantity && body.quantity > 0 ? body.quantity : risk.positionSize;
  const price = body.thesis.entry;
  let notional = quantity * price;

  // Server-side max notional cap (protect throwaway testnet account)
  if (price > 0 && notional > SODEX_MAX_NOTIONAL_USDC) {
    quantity = SODEX_MAX_NOTIONAL_USDC / price;
    notional = quantity * price;
  }
  if (quantity <= 0 || !Number.isFinite(quantity)) {
    return NextResponse.json({ error: 'Invalid quantity after risk / notional caps' }, { status: 400 });
  }

  const order = await placeLimitOrder({
    thesisId: body.thesis.id,
    symbol: body.thesis.symbol,
    side,
    price,
    quantity,
    confirmed: true,
  });

  let row: { id: string } | null = null;
  try {
    row = logIdea(body.thesis, order.mode === 'live' ? 'live' : 'dry-run', order.orderId);
  } catch (e) {
    console.warn('[trade] track-record log failed', e);
  }
  let queried: { status?: string; ok?: boolean } | null = null;
  if (order.mode === 'live' && order.orderId) {
    queried = await querySpotOrder(order.orderId);
    if (row && queried.ok && queried.status) {
      try {
        updateOrderStatus(row.id, queried.status);
      } catch (e) {
        console.warn('[trade] track-record update failed', e);
      }
    }
  }

  const live = hasSodexCredentials() && order.mode === 'live';
  return NextResponse.json({
    order,
    risk,
    trackId: row?.id ?? null,
    queried,
    notionalUsd: Number(notional.toFixed(6)),
    maxNotionalUsdc: SODEX_MAX_NOTIONAL_USDC,
    modeLabel: live ? 'TESTNET_LIVE_EIP712' : 'DRY_RUN_SIMULATED',
    keys: { sodexTrade: hasSodexCredentials() },
  });
}
