import { describe, expect, it } from 'vitest';
import { detectIntent, groundedAnswer } from '../lib/voice-answer';
import type { DeskSnapshot } from '../types/flow';

const desk: DeskSnapshot = {
  etfBtc: {
    symbol: 'BTC',
    country: 'US',
    latest: { date: '2026-10-29', totalNetInflow: 40e6, totalValueTraded: 1e9, totalNetAssets: 1e10, cumNetInflow: 1e10 },
    history: [],
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  },
  etfEth: {
    symbol: 'ETH',
    country: 'US',
    latest: { date: '2026-10-29', totalNetInflow: -20e6, totalValueTraded: 1e9, totalNetAssets: 1e10, cumNetInflow: 1e10 },
    history: [],
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  },
  news: {
    items: [{ id: '1', title: 'Quiet tape', url: '#', summary: '', publishedAt: new Date().toISOString(), isShock: false }],
    shockActive: false,
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  },
  ssi: {
    ticker: 'ssiMAG7',
    price: 21,
    changePct24h: 0.01,
    roi7d: 0.02,
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  },
  market: {
    tickers: [{ symbol: 'vBTC_vUSDC', lastPrice: 80000, changePct24h: 1, high: 81e3, low: 79e3, volume: 1 }],
    meta: { source: 'live', fetchedAt: new Date().toISOString() },
  },
  thesis: {
    id: 't1',
    createdAt: new Date().toISOString(),
    side: 'LONG',
    symbol: 'vBTC_vUSDC',
    plainEnglish: 'Lean long on BTC flows.',
    confidence: 70,
    entry: 80000,
    stopLoss: 78000,
    takeProfit: 84000,
    drivers: {
      etfBtcNetInflow: 40e6,
      etfEthNetInflow: -20e6,
      ssiChangePct: 0.01,
      newsShock: false,
      topHeadlines: ['Quiet tape'],
    },
    engine: 'rules',
    horizonHours: 24,
  },
  risk: {
    approved: true,
    checks: [{ id: 'direction', label: 'Directional thesis', passed: true, detail: 'LONG' }],
    positionSize: 0.05,
    notionalUsd: 4000,
    riskUsd: 100,
    riskPct: 1,
    equityUsd: 10000,
  },
  demoMode: true,
};

describe('voice intents', () => {
  it('blocks order-by-voice', () => {
    expect(detectIntent('place a buy order now')).toBe('order_blocked');
    const a = groundedAnswer(desk, 'order_blocked', 'buy');
    expect(a.toLowerCase()).toContain('cannot place');
  });

  it('detects refresh and risk', () => {
    expect(detectIntent('refresh thesis')).toBe('refresh');
    expect(detectIntent('explain risk')).toBe('explain_risk');
  });

  it('grounds flows and thesis', () => {
    expect(groundedAnswer(desk, 'flows', '')).toMatch(/BTC US ETF/i);
    expect(groundedAnswer(desk, 'read_thesis', '')).toMatch(/LONG/);
  });
});
