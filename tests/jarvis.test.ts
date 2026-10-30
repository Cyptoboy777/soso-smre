import { describe, expect, it } from 'vitest';
import { buildJarvisBriefing } from '@/lib/jarvis';
import type { DeskSnapshot } from '@/types/flow';

const desk = {
  etfBtc: {
    symbol: 'BTC',
    country: 'US',
    latest: { date: '2026-10-29', totalNetInflow: 50_000_000, totalValueTraded: 1, totalNetAssets: 1, cumNetInflow: 1 },
    history: [],
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  },
  etfEth: {
    symbol: 'ETH',
    country: 'US',
    latest: { date: '2026-10-29', totalNetInflow: -10_000_000, totalValueTraded: 1, totalNetAssets: 1, cumNetInflow: 1 },
    history: [],
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  },
  news: {
    items: [
      {
        id: 'n1',
        title: 'ETF inflows rebound',
        url: 'https://example.com',
        summary: 'BTC ETF books print',
        publishedAt: new Date().toISOString(),
        isShock: false,
      },
    ],
    shockActive: false,
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  },
  ssi: {
    ticker: 'ssiMAG7',
    price: 22,
    changePct24h: 0.01,
    roi7d: 0.02,
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  },
  market: {
    tickers: [{ symbol: 'vBTC_vUSDC', lastPrice: 80000, changePct24h: -0.2, high: 81000, low: 79000, volume: 1 }],
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  },
  thesis: {
    id: 't1',
    createdAt: new Date().toISOString(),
    side: 'FLAT',
    symbol: 'vBTC_vUSDC',
    plainEnglish: 'Stand aside.',
    confidence: 40,
    entry: 80000,
    stopLoss: 80000,
    takeProfit: 80000,
    drivers: {
      etfBtcNetInflow: 50_000_000,
      etfEthNetInflow: -10_000_000,
      ssiChangePct: 0.01,
      newsShock: false,
      topHeadlines: ['ETF inflows rebound'],
    },
    engine: 'rules',
    horizonHours: 24,
  },
  risk: {
    approved: false,
    checks: [],
    positionSize: 0,
    notionalUsd: 0,
    riskUsd: 0,
    riskPct: 0,
    equityUsd: 10000,
  },
  demoMode: true,
} as DeskSnapshot;

describe('jarvis briefing', () => {
  it('returns 3 ranked ideas with citations', async () => {
    const b = await buildJarvisBriefing(desk);
    expect(b.ideas).toHaveLength(3);
    expect(b.ideas[0].rank).toBe(1);
    expect(b.ideas[0].citations.length).toBeGreaterThan(0);
    expect(b.spokenSummary.toLowerCase()).toContain('voice never places orders');
  });
});
