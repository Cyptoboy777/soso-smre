import { describe, expect, it } from 'vitest';
import {
  buildShortRulePlain,
  correctFlowWording,
  describeEtfFlow,
  flowDirectionWord,
  normalizeThesisPlain,
  pickNewsChips,
  sanitizeHeadline,
} from '../lib/thesis-copy';
import { buildRuleThesis } from '../lib/signal';
import type { EtfPanel, MarketPanel, NewsPanel, SsiPanel } from '../types/flow';

describe('flow wording', () => {
  it('maps sign to inflow/outflow', () => {
    expect(flowDirectionWord(10)).toBe('inflow');
    expect(flowDirectionWord(0)).toBe('inflow');
    expect(flowDirectionWord(-1)).toBe('outflow');
  });

  it('describes negative ETF dollars as outflow', () => {
    expect(describeEtfFlow(-201_000_000, 'BTC')).toMatch(/net outflow/);
    expect(describeEtfFlow(-201_000_000, 'BTC')).not.toMatch(/inflow/);
    expect(describeEtfFlow(50_000_000, 'ETH')).toMatch(/net inflow/);
  });

  it('rewrites negative inflow phrasing', () => {
    const raw =
      'caution is warranted alongside negative ETF net inflows, and we remain flat on the desk today. No trade setup.';
    const fixed = correctFlowWording(raw);
    expect(fixed.toLowerCase()).toContain('outflow');
    expect(fixed.toLowerCase()).not.toMatch(/negative etf net inflow/);
  });
});

describe('sanitizeHeadline', () => {
  it('strips truncated viewing-it-as fragments', () => {
    const dirty =
      'Kim Yo Jong speaks out again regarding the Binance hack incident, viewing it as ;';
    expect(sanitizeHeadline(dirty)).toBe(
      'Kim Yo Jong speaks out again regarding the Binance hack incident',
    );
  });
});

describe('normalizeThesisPlain', () => {
  it('keeps at most two sentences and drops Related news + desk jargon', () => {
    const raw =
      'With active news shocks concerning geopolitical tensions mentioned by Kim Yo Jong speaks out again regarding the Binance hack incident and BTC falling below $77,000 alongside negative ETF net inflows, caution is warranted. Given the weak conviction and uncertain macro conditions, we remain flat on the desk today. No trade setup. Related: Kim Yo Jong speaks out again regarding the Binance hack incident, viewing it as ; BTC fell below $77,000, down 0.90% on the day.';
    const out = normalizeThesisPlain(raw, { maxSentences: 2 });
    expect(out.toLowerCase()).not.toContain('related:');
    expect(out.toLowerCase()).not.toContain('on the desk');
    expect(out.toLowerCase()).not.toContain('no trade setup');
    expect(out.toLowerCase()).toMatch(/outflow/);
    expect(out.toLowerCase()).not.toMatch(/negative etf net inflow/);
    const sentences = out.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences.length).toBeLessThanOrEqual(2);
  });
});

describe('pickNewsChips', () => {
  it('returns up to 3 cleaned chips', () => {
    const chips = pickNewsChips(
      [
        'Kim Yo Jong speaks out again regarding the Binance hack incident, viewing it as ;',
        'BTC fell below $77,000, down 0.90% on the day',
        'Quiet day in markets',
        'Fourth headline ignored',
      ],
      [
        {
          title: 'Kim Yo Jong speaks out again regarding the Binance hack incident, viewing it as ;',
          url: 'https://example.com/a',
        },
        { title: 'BTC fell below $77,000, down 0.90% on the day', url: 'https://example.com/b' },
      ],
      3,
    );
    expect(chips).toHaveLength(3);
    expect(chips[0].title).not.toMatch(/viewing it as/i);
    expect(chips[0].url).toContain('example.com');
  });
});

describe('rule thesis plain copy', () => {
  const etf = (symbol: 'BTC' | 'ETH', inflow: number): EtfPanel => ({
    symbol,
    country: 'US',
    latest: {
      date: '2026-11-04',
      totalNetInflow: inflow,
      totalValueTraded: 1e9,
      totalNetAssets: 1e10,
      cumNetInflow: 1e10,
    },
    history: [],
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  });
  const news: NewsPanel = {
    items: [
      {
        id: '1',
        title: 'Kim Yo Jong speaks out again regarding the Binance hack incident, viewing it as ;',
        url: 'https://example.com/n',
        summary: '',
        publishedAt: new Date().toISOString(),
        isShock: true,
      },
    ],
    shockActive: true,
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  };
  const ssi: SsiPanel = {
    ticker: 'ssiMAG7',
    price: 22,
    changePct24h: -0.01,
    roi7d: 0,
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  };
  const market: MarketPanel = {
    tickers: [
      { symbol: 'vBTC_vUSDC', lastPrice: 77000, changePct24h: -1, high: 78000, low: 76000, volume: 10 },
      { symbol: 'vETH_vUSDC', lastPrice: 3500, changePct24h: -0.5, high: 3600, low: 3400, volume: 100 },
    ],
    meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
  };

  it('uses outflow wording for negative ETF flows and stays short', () => {
    const thesis = buildRuleThesis({
      etfBtc: etf('BTC', -201_000_000),
      etfEth: etf('ETH', -40_000_000),
      news,
      ssi,
      market,
    });
    expect(thesis.plainEnglish.toLowerCase()).toMatch(/outflow/);
    expect(thesis.plainEnglish.toLowerCase()).not.toMatch(/negative .* inflow/);
    expect(thesis.plainEnglish.toLowerCase()).not.toContain('related:');
    const sentences = thesis.plainEnglish.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences.length).toBeLessThanOrEqual(2);
    expect(thesis.drivers.topHeadlines[0]).not.toMatch(/viewing it as/i);
  });

  it('buildShortRulePlain stays within two sentences', () => {
    const plain = buildShortRulePlain({
      side: 'FLAT',
      symbol: 'vBTC_vUSDC',
      btcFlow: -100,
      ethFlow: null,
      newsShock: true,
    });
    expect(plain.split(/(?<=[.!?])\s+/).filter(Boolean).length).toBeLessThanOrEqual(2);
    expect(plain.toLowerCase()).toContain('outflow');
  });
});
