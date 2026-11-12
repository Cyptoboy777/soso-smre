import { describe, expect, it } from 'vitest';
import { pickPrice } from '@/lib/sodex';
import type { MarketPanel } from '@/types/flow';

const empty: MarketPanel = {
  tickers: [],
  meta: { source: 'unavailable', fetchedAt: '2026-11-12T00:00:00.000Z' },
};

describe('no invented market prices', () => {
  it('returns 0 when the panel is empty, never a stand-in BTC or ETH price', () => {
    expect(pickPrice(empty, 'vBTC_vUSDC')).toBe(0);
    expect(pickPrice(empty, 'vETH_vUSDC')).toBe(0);
    expect(pickPrice(empty, 'BTC_USDC')).toBe(0);
  });

  it('uses a live ticker when one is present', () => {
    const market: MarketPanel = {
      tickers: [
        { symbol: 'vBTC_vUSDC', lastPrice: 73529, changePct24h: -0.38, high: 74700, low: 73347, volume: 0.03 },
      ],
      meta: { source: 'live', endpoint: 'https://mainnet-gw.sodex.dev/api/v1/spot/markets/tickers', fetchedAt: '2026-11-12T00:00:00.000Z' },
    };
    expect(pickPrice(market, 'vBTC_vUSDC')).toBe(73529);
  });
});
