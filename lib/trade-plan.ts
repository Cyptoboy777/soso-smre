import { deriveTradeLevels, type TradeSide } from '@/lib/trade-levels';

export type LiveTradePlan = {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  status: 'active' | 'expired' | 'recomputed';
  reason?: string;
};

/**
 * Keep a desk trade plan honest against the live mid/last price.
 * - Stop already hit → Expired (do not show as active).
 * - Target already hit → Expired (move complete).
 * - Price has moved past entry against the idea (toward the stop) by a
 *   meaningful fraction of the stop distance → recompute from live price.
 */
export function resolveLiveTradePlan(opts: {
  side: TradeSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  livePrice: number | null | undefined;
}): LiveTradePlan {
  const { side, entry, stopLoss, takeProfit } = opts;
  const live = opts.livePrice != null && Number.isFinite(opts.livePrice) ? Number(opts.livePrice) : null;

  if (side === 'FLAT' || !live || live <= 0) {
    return { entry, stopLoss, takeProfit, status: 'active' };
  }

  if (side === 'SHORT') {
    if (live >= stopLoss) {
      return {
        entry,
        stopLoss,
        takeProfit,
        status: 'expired',
        reason: 'Live price already past the stop',
      };
    }
    if (live <= takeProfit) {
      return {
        entry,
        stopLoss,
        takeProfit,
        status: 'expired',
        reason: 'Target already reached',
      };
    }
    // Past entry against the short (price up toward stop)
    const risk = Math.max(stopLoss - entry, entry * 0.001);
    if (live > entry && (live - entry) / risk >= 0.35) {
      const next = deriveTradeLevels('SHORT', live);
      return {
        entry: next.entry,
        stopLoss: next.stopLoss,
        takeProfit: next.takeProfit,
        status: 'recomputed',
        reason: 'Levels refreshed from live price',
      };
    }
  }

  if (side === 'LONG') {
    if (live <= stopLoss) {
      return {
        entry,
        stopLoss,
        takeProfit,
        status: 'expired',
        reason: 'Live price already past the stop',
      };
    }
    if (live >= takeProfit) {
      return {
        entry,
        stopLoss,
        takeProfit,
        status: 'expired',
        reason: 'Target already reached',
      };
    }
    const risk = Math.max(entry - stopLoss, entry * 0.001);
    if (live < entry && (entry - live) / risk >= 0.35) {
      const next = deriveTradeLevels('LONG', live);
      return {
        entry: next.entry,
        stopLoss: next.stopLoss,
        takeProfit: next.takeProfit,
        status: 'recomputed',
        reason: 'Levels refreshed from live price',
      };
    }
  }

  return { entry, stopLoss, takeProfit, status: 'active' };
}
