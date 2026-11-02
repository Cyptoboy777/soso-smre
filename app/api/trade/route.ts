import { NextResponse } from 'next/server';
import {
  placeLimitOrder,
  placeMarketBuyFunds,
  querySpotOrder,
  hasSodexCredentials,
  SODEX_MAX_NOTIONAL_USDC,
} from '@/lib/sodex';
import { evaluateRisk } from '@/lib/risk-engine';
import { logIdea, updateOrderStatus } from '@/lib/track-record';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';
import {
  hardenThesisForRisk,
  isAllowedTradeSymbol,
  serverNewsForRisk,
} from '@/lib/trade-guard';
import type { NewsPanel, Thesis } from '@/types/flow';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = clientIp(req);
  // Shared testnet key: tight per-IP budget (per isolate).
  const limited = rejectIfRateLimited(
    `trade:${ip}`,
    6,
    60 * 60_000,
    'Rate limit: max 6 trade attempts per hour from this IP',
  );
  if (limited) return limited;

  const body = (await req.json()) as {
    thesis: Thesis;
    news: NewsPanel;
    confirmed: boolean;
    quantity?: number;
    /** When true, place a tiny MARKET buy using quote funds (capped). */
    marketBuy?: boolean;
    fundsUsdc?: number;
  };

  if (!body.thesis || !body.news) {
    return NextResponse.json({ error: 'thesis and news required' }, { status: 400 });
  }
  if (!body.confirmed) {
    return NextResponse.json({ error: 'Explicit confirmation required' }, { status: 400 });
  }

  const thesis = hardenThesisForRisk(body.thesis);
  if (!isAllowedTradeSymbol(thesis.symbol)) {
    return NextResponse.json(
      { error: 'Symbol not allowlisted for FlowSentinel testnet orders', symbol: thesis.symbol },
      { status: 400 },
    );
  }

  // Never trust client shockActive — re-fetch SoSoValue news server-side.
  const news = await serverNewsForRisk(body.news);
  const risk = evaluateRisk(thesis, news);
  if (!risk.approved) {
    return NextResponse.json(
      { error: 'Risk gate blocked this order', risk },
      { status: 403 },
    );
  }

  const side = thesis.side === 'SHORT' ? 'SELL' : 'BUY';
  let quantity = body.quantity && body.quantity > 0 ? body.quantity : risk.positionSize;
  const price = thesis.entry;
  let notional = quantity * price;

  // Server-side max notional cap (protect throwaway testnet account)
  if (price > 0 && notional > SODEX_MAX_NOTIONAL_USDC) {
    quantity = SODEX_MAX_NOTIONAL_USDC / price;
    notional = quantity * price;
  }
  if (quantity <= 0 || !Number.isFinite(quantity)) {
    return NextResponse.json({ error: 'Invalid quantity after risk / notional caps' }, { status: 400 });
  }

  const order = body.marketBuy
    ? await placeMarketBuyFunds({
        symbol: thesis.symbol,
        fundsUsdc: Math.min(
          body.fundsUsdc && body.fundsUsdc > 0 ? body.fundsUsdc : Math.min(notional, SODEX_MAX_NOTIONAL_USDC),
          SODEX_MAX_NOTIONAL_USDC,
        ),
        thesisId: thesis.id,
        confirmed: true,
      })
    : await placeLimitOrder({
        thesisId: thesis.id,
        symbol: thesis.symbol,
        side,
        price,
        quantity,
        confirmed: true,
      });

  let row: { id: string } | null = null;
  try {
    row = logIdea(thesis, order.mode === 'live' ? 'live' : 'dry-run', order.orderId);
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
