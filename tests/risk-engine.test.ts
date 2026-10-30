import { describe, expect, it } from 'vitest';
import { evaluateRisk } from '../lib/risk-engine';
import type { NewsPanel, Thesis } from '../types/flow';

const baseThesis = (over: Partial<Thesis> = {}): Thesis => ({
  id: 't1',
  createdAt: new Date().toISOString(),
  side: 'LONG',
  symbol: 'vBTC_vUSDC',
  plainEnglish: 'test',
  confidence: 70,
  entry: 100,
  stopLoss: 97,
  takeProfit: 106,
  drivers: {
    etfBtcNetInflow: 50_000_000,
    etfEthNetInflow: 10_000_000,
    ssiChangePct: 0.01,
    newsShock: false,
    topHeadlines: [],
  },
  engine: 'rules',
  horizonHours: 24,
  ...over,
});

const quietNews: NewsPanel = {
  items: [],
  shockActive: false,
  meta: { source: 'fallback', fetchedAt: new Date().toISOString() },
};

describe('evaluateRisk', () => {
  it('approves a well-formed long', () => {
    const d = evaluateRisk(baseThesis(), quietNews);
    expect(d.approved).toBe(true);
    expect(d.positionSize).toBeGreaterThan(0);
    expect(d.checks.every((c) => c.passed)).toBe(true);
  });

  it('rejects FLAT', () => {
    const d = evaluateRisk(baseThesis({ side: 'FLAT' }), quietNews);
    expect(d.approved).toBe(false);
    expect(d.checks.find((c) => c.id === 'direction')?.passed).toBe(false);
  });

  it('rejects news shock when blocking', () => {
    const shocked = { ...quietNews, shockActive: true };
    const d = evaluateRisk(baseThesis(), shocked);
    expect(d.approved).toBe(false);
    expect(d.checks.find((c) => c.id === 'news_shock')?.passed).toBe(false);
  });

  it('rejects bad geometry', () => {
    const d = evaluateRisk(baseThesis({ stopLoss: 105, takeProfit: 110 }), quietNews);
    expect(d.approved).toBe(false);
    expect(d.checks.find((c) => c.id === 'geometry')?.passed).toBe(false);
  });

  it('rejects low confidence', () => {
    const d = evaluateRisk(baseThesis({ confidence: 40 }), quietNews);
    expect(d.approved).toBe(false);
  });

  it('rejects when drawdown breached', () => {
    const d = evaluateRisk(baseThesis(), quietNews, { currentDrawdownPct: 6, maxDrawdownPct: 5 });
    expect(d.approved).toBe(false);
    expect(d.checks.find((c) => c.id === 'max_drawdown')?.passed).toBe(false);
  });

  it('sizes from risk budget', () => {
    // equity 10k, 1% risk = $100, stop dist $3 → qty ≈ 33.33 (raise maxPositionPct so notional is not capped)
    const d = evaluateRisk(baseThesis({ entry: 100, stopLoss: 97, takeProfit: 106 }), quietNews, {
      equityUsd: 10_000,
      riskPerTradePct: 1,
      maxPositionPct: 50,
    });
    expect(d.approved).toBe(true);
    expect(d.riskUsd).toBeCloseTo(100, 0);
    expect(d.positionSize).toBeCloseTo(100 / 3, 1);
  });
});
