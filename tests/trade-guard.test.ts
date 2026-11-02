import { describe, expect, it } from 'vitest';
import { hardenThesisForRisk, isAllowedTradeSymbol } from '@/lib/trade-guard';
import type { Thesis } from '@/types/flow';

describe('trade-guard', () => {
  it('allowlists known spot symbols only', () => {
    expect(isAllowedTradeSymbol('vBTC_vUSDC')).toBe(true);
    expect(isAllowedTradeSymbol('vETH_vUSDC')).toBe(true);
    expect(isAllowedTradeSymbol('../evil')).toBe(false);
    expect(isAllowedTradeSymbol('vBTC_vUSDC;drop')).toBe(false);
  });

  it('preserves thesis fields while hardening drivers', () => {
    const thesis = {
      id: 't1',
      createdAt: '2026-01-01T00:00:00.000Z',
      side: 'LONG',
      symbol: ' vBTC_vUSDC ',
      plainEnglish: 'x',
      confidence: 80,
      entry: 100,
      stopLoss: 90,
      takeProfit: 120,
      drivers: {
        etfBtcNetInflow: 1,
        etfEthNetInflow: null,
        ssiChangePct: null,
        newsShock: false,
        topHeadlines: [],
      },
      engine: 'rules',
      horizonHours: 24,
    } as Thesis;
    const h = hardenThesisForRisk(thesis);
    expect(h.symbol).toBe('vBTC_vUSDC');
    expect(h.drivers.newsShock).toBe(false);
    expect(h.confidence).toBe(80);
  });
});
