import { afterEach, describe, expect, it } from 'vitest';
import { assertRelayOrderParams } from '@/lib/builder-order-guard';
import { normalizeIdeaId, normalizeRef } from '@/lib/referral';

const ENV_KEYS = ['SODEX_BUILDER_ID', 'SODEX_BUILDER_FEE', 'SODEX_MAX_NOTIONAL_USDC'] as const;
const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (k in saved) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
      delete saved[k];
    }
  }
});

function setEnv(k: (typeof ENV_KEYS)[number], v: string | undefined) {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

describe('assertRelayOrderParams', () => {
  it('rejects oversize notional even if signed client-side', () => {
    setEnv('SODEX_BUILDER_ID', '2674');
    setEnv('SODEX_BUILDER_FEE', '10');
    setEnv('SODEX_MAX_NOTIONAL_USDC', '10');
    const res = assertRelayOrderParams({
      accountID: 1,
      orders: [
        {
          symbolID: 1,
          clOrdID: 'fs-x',
          side: 1,
          type: 1,
          timeInForce: 1,
          price: '100000',
          quantity: '1',
        },
      ],
      builder: { id: 2674, fee: 10 },
    });
    expect(res.ok).toBe(false);
  });

  it('accepts capped limit order with matching builder fee', () => {
    setEnv('SODEX_BUILDER_ID', '2674');
    setEnv('SODEX_BUILDER_FEE', '10');
    setEnv('SODEX_MAX_NOTIONAL_USDC', '10');
    const res = assertRelayOrderParams({
      accountID: 1,
      orders: [
        {
          symbolID: 1,
          clOrdID: 'fs-x',
          side: 1,
          type: 1,
          timeInForce: 1,
          price: '50000',
          quantity: '0.0001',
        },
      ],
      builder: { id: 2674, fee: 10 },
    });
    expect(res.ok).toBe(true);
  });

  it('rejects builder fee mismatch', () => {
    setEnv('SODEX_BUILDER_ID', '2674');
    setEnv('SODEX_BUILDER_FEE', '10');
    const res = assertRelayOrderParams({
      accountID: 1,
      orders: [
        {
          symbolID: 1,
          clOrdID: 'fs-x',
          side: 2,
          type: 1,
          timeInForce: 1,
          price: '1',
          quantity: '1',
        },
      ],
      builder: { id: 2674, fee: 99 },
    });
    expect(res.ok).toBe(false);
  });
});

describe('referral / idea sanitise', () => {
  it('blocks path-like idea and ref values', () => {
    expect(normalizeRef('../x')).toBeNull();
    expect(normalizeIdeaId('<script>')).toBeNull();
    expect(normalizeIdeaId('btc-long_1')).toBe('btc-long_1');
  });
});
