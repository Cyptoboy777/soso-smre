import { describe, expect, it } from 'vitest';
import {
  buildDrivers,
  buildRuleThesis,
  confidenceFromScore,
  scoreFlows,
  sideFromScore,
} from '../lib/signal';
import type { EtfPanel, MarketPanel, NewsPanel, SsiPanel } from '../types/flow';

const etf = (symbol: 'BTC' | 'ETH', inflow: number): EtfPanel => ({
  symbol,
  country: 'US',
  latest: {
    date: '2026-10-29',
    totalNetInflow: inflow,
    totalValueTraded: 1e9,
    totalNetAssets: 1e10,
    cumNetInflow: 1e10,
  },
  history: [],
  meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
});

const newsQuiet: NewsPanel = {
  items: [{ id: '1', title: 'Quiet day', url: '#', summary: '', publishedAt: new Date().toISOString(), isShock: false }],
  shockActive: false,
  meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
};

const ssiUp: SsiPanel = {
  ticker: 'ssiMAG7',
  price: 22,
  changePct24h: 0.02,
  roi7d: 0.05,
  meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
};

const market: MarketPanel = {
  tickers: [
    { symbol: 'vBTC_vUSDC', lastPrice: 100_000, changePct24h: 1, high: 101_000, low: 99_000, volume: 10 },
    { symbol: 'vETH_vUSDC', lastPrice: 3500, changePct24h: 0.5, high: 3550, low: 3400, volume: 100 },
  ],
  meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
};

describe('signal scoring', () => {
  it('maps strong inflow to LONG', () => {
    const drivers = buildDrivers({
      etfBtc: etf('BTC', 300_000_000),
      etfEth: etf('ETH', 80_000_000),
      news: newsQuiet,
      ssi: ssiUp,
      market,
    });
    const score = scoreFlows(drivers);
    expect(score).toBeGreaterThan(18);
    expect(sideFromScore(score)).toBe('LONG');
  });

  it('maps strong outflow to SHORT', () => {
    const drivers = buildDrivers({
      etfBtc: etf('BTC', -300_000_000),
      etfEth: etf('ETH', -80_000_000),
      news: newsQuiet,
      ssi: { ...ssiUp, changePct24h: -0.02 },
      market,
    });
    const score = scoreFlows(drivers);
    expect(score).toBeLessThan(-18);
    expect(sideFromScore(score)).toBe('SHORT');
  });

  it('dampens score on news shock', () => {
    const base = buildDrivers({
      etfBtc: etf('BTC', 300_000_000),
      etfEth: etf('ETH', 80_000_000),
      news: newsQuiet,
      ssi: ssiUp,
      market,
    });
    const shocked = { ...base, newsShock: true };
    expect(Math.abs(scoreFlows(shocked))).toBeLessThan(Math.abs(scoreFlows(base)));
  });

  it('confidence scales with magnitude', () => {
    expect(confidenceFromScore(0)).toBeLessThan(confidenceFromScore(80));
    expect(confidenceFromScore(100)).toBeLessThanOrEqual(92);
  });

  it('builds a coherent rule thesis', () => {
    const thesis = buildRuleThesis({
      etfBtc: etf('BTC', 250_000_000),
      etfEth: etf('ETH', 10_000_000),
      news: newsQuiet,
      ssi: ssiUp,
      market,
    });
    expect(thesis.engine).toBe('rules');
    expect(thesis.side).toBe('LONG');
    expect(thesis.stopLoss).toBeLessThan(thesis.entry);
    expect(thesis.takeProfit).toBeGreaterThan(thesis.entry);
    expect(thesis.plainEnglish.length).toBeGreaterThan(40);
    expect(thesis.drivers.etfBtcNetInflow).toBe(250_000_000);
  });
});
