import { describe, expect, it } from 'vitest';
import {
  deriveTradeLevels,
  hasValidTradeSetup,
  normalizeConfidence,
  normalizeTradeLevels,
} from '@/lib/trade-levels';

describe('trade levels', () => {
  it('derives distinct LONG stop/target below/above entry', () => {
    const l = deriveTradeLevels('LONG', 77466);
    expect(l.hasSetup).toBe(true);
    expect(l.stopLoss).toBeLessThan(l.entry);
    expect(l.takeProfit).toBeGreaterThan(l.entry);
    expect(l.entry).not.toBe(l.stopLoss);
    expect(l.entry).not.toBe(l.takeProfit);
  });

  it('derives distinct SHORT stop/target', () => {
    const l = deriveTradeLevels('SHORT', 77466);
    expect(l.hasSetup).toBe(true);
    expect(l.stopLoss).toBeGreaterThan(l.entry);
    expect(l.takeProfit).toBeLessThan(l.entry);
  });

  it('FLAT is not a trade setup', () => {
    const l = deriveTradeLevels('FLAT', 77466);
    expect(l.hasSetup).toBe(false);
    expect(l.reason).toMatch(/No trade setup/i);
  });

  it('normalizes identical model levels into a real setup or FLAT', () => {
    const bad = normalizeTradeLevels({
      side: 'LONG',
      entry: 77466,
      stopLoss: 77466,
      takeProfit: 77466,
    });
    expect(bad.hasSetup).toBe(true);
    expect(hasValidTradeSetup('LONG', bad.entry, bad.stopLoss, bad.takeProfit)).toBe(
      true,
    );
  });

  it('caps overconfident scores', () => {
    expect(normalizeConfidence(99, { side: 'LONG', hasSetup: true })).toBeLessThanOrEqual(
      88,
    );
    expect(
      normalizeConfidence(85, { side: 'FLAT', hasSetup: false }),
    ).toBeLessThanOrEqual(55);
  });
});
