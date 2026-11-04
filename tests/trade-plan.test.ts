import { describe, expect, it } from 'vitest';
import { resolveLiveTradePlan } from '@/lib/trade-plan';

describe('resolveLiveTradePlan', () => {
  it('expires a short when live price is past the stop', () => {
    const plan = resolveLiveTradePlan({
      side: 'SHORT',
      entry: 77077,
      stopLoss: 78200,
      takeProfit: 74500,
      livePrice: 78385,
    });
    expect(plan.status).toBe('expired');
    expect(plan.reason).toMatch(/stop/i);
  });

  it('recomputes a short when price moved against entry toward stop', () => {
    const plan = resolveLiveTradePlan({
      side: 'SHORT',
      entry: 77077,
      stopLoss: 80000,
      takeProfit: 74000,
      livePrice: 78277,
    });
    expect(plan.status).toBe('recomputed');
    expect(plan.entry).toBeGreaterThan(77000);
    expect(plan.stopLoss).toBeGreaterThan(plan.entry);
    expect(plan.takeProfit).toBeLessThan(plan.entry);
  });

  it('keeps an active short when price is still near entry', () => {
    const plan = resolveLiveTradePlan({
      side: 'SHORT',
      entry: 78000,
      stopLoss: 79000,
      takeProfit: 76000,
      livePrice: 77950,
    });
    expect(plan.status).toBe('active');
    expect(plan.entry).toBe(78000);
  });

  it('expires a long when live price is past the stop', () => {
    const plan = resolveLiveTradePlan({
      side: 'LONG',
      entry: 77000,
      stopLoss: 76000,
      takeProfit: 80000,
      livePrice: 75500,
    });
    expect(plan.status).toBe('expired');
  });
});
