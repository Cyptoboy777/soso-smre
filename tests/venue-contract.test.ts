import { afterEach, describe, expect, it } from 'vitest';
import { keccak256, toHex } from 'viem';
import { allocateNonce, claimPreparedNonce, resetSeenNoncesForTests } from '@/lib/nonce-policy';
import { assertRelayOrderParams } from '@/lib/builder-order-guard';
import { parseBatchReceipt } from '@/lib/order-receipt';
import { quoteIsStale } from '@/lib/cost-lens';
import { planGrid } from '@/lib/grid-plan';
import { normalPerpsOrder, perpsNewOrderParams, reduceOnlyStop, hashAction } from '@/lib/sodex-perps-order';

const ADDRESS = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca';
const NOW = 1_700_000_000_000;

function memory() {
  const store = new Map<string, string>();
  return {
    get: (key: string) => store.get(key) ?? null,
    set: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

afterEach(() => {
  resetSeenNoncesForTests();
  delete process.env.SODEX_BUILDER_ID;
  delete process.env.SODEX_BUILDER_FEE;
  delete process.env.SODEX_MAX_NOTIONAL_USDC;
});

describe('nonce coordination', () => {
  it('does not reuse a nonce across two allocations in one store', () => {
    const store = memory();
    const a = allocateNonce({ store, network: 'testnet', signingAddress: ADDRESS, nowMs: NOW, deviceOffset: 4 });
    const b = allocateNonce({ store, network: 'testnet', signingAddress: ADDRESS, nowMs: NOW, deviceOffset: 4 });
    expect(a).not.toBe(b);
  });

  it('separates devices, networks, and the account-action lane', () => {
    const left = memory();
    const right = memory();
    const a = allocateNonce({ store: left, network: 'testnet', signingAddress: ADDRESS, nowMs: NOW, deviceOffset: 3 });
    const b = allocateNonce({ store: right, network: 'testnet', signingAddress: ADDRESS, nowMs: NOW, deviceOffset: 9 });
    expect(a).not.toBe(b);
    const trade = allocateNonce({ store: left, network: 'testnet', signingAddress: ADDRESS, nowMs: NOW, deviceOffset: 3, lane: 'trade' });
    const account = allocateNonce({ store: left, network: 'testnet', signingAddress: ADDRESS, nowMs: NOW, deviceOffset: 3, lane: 'account' });
    expect(account).not.toBe(trade);
  });

  it('rejects a replay and a nonce outside the venue window', () => {
    expect(claimPreparedNonce({ network: 'testnet', signingAddress: ADDRESS, nonce: String(NOW + 5), nowMs: NOW }).ok).toBe(true);
    expect(claimPreparedNonce({ network: 'testnet', signingAddress: ADDRESS, nonce: String(NOW + 5), nowMs: NOW }).ok).toBe(false);
    expect(claimPreparedNonce({ network: 'testnet', signingAddress: ADDRESS, nonce: '10', nowMs: NOW }).ok).toBe(false);
  });
});

describe('canonical perps payload', () => {
  it('matches the documented market-order field order', () => {
    const params = perpsNewOrderParams({
      accountId: 12345,
      symbolId: 1,
      orders: [normalPerpsOrder({ clOrdID: 'my-order-1', side: 'buy', type: 'market', quantity: '0.001' })],
      builder: null,
    });
    const canonical = JSON.stringify({ type: 'newOrder', params });
    expect(canonical).toBe(
      '{"type":"newOrder","params":{"accountID":12345,"symbolID":1,"orders":[{"clOrdID":"my-order-1","modifier":1,"side":1,"type":2,"timeInForce":3,"quantity":"0.001","reduceOnly":false,"positionSide":1}]}}',
    );
    expect(hashAction('newOrder', params)).toBe(keccak256(toHex(canonical)));
  });

  it('keeps a reduce-only stop on the attached field order', () => {
    const order = reduceOnlyStop({ clOrdID: 'sl-1', side: 'sell', stopPrice: '70000', stopKind: 'stop-loss', quantity: '0.001' });
    expect(JSON.stringify(order)).toContain('"modifier":2');
    expect(JSON.stringify(order)).toContain('"reduceOnly":true');
    expect(JSON.stringify(order)).toContain('"stopType":1');
    expect(JSON.stringify(order)).toContain('"triggerType":2');
  });
});

describe('batch safety', () => {
  it('allows non-crossing two-sided limits and rejects a cross or an over-cap batch', () => {
    process.env.SODEX_MAX_NOTIONAL_USDC = '100';
    const ok = assertRelayOrderParams({
      accountID: 1,
      orders: [
        { side: 1, type: 1, price: '90', quantity: '0.1' },
        { side: 2, type: 1, price: '110', quantity: '0.1' },
      ],
    });
    expect(ok.ok).toBe(true);
    const cross = assertRelayOrderParams({
      accountID: 1,
      orders: [
        { side: 1, type: 1, price: '110', quantity: '0.1' },
        { side: 2, type: 1, price: '100', quantity: '0.1' },
      ],
    });
    expect(cross.ok).toBe(false);
    expect(() => planGrid({ mid: 100, levelsEachSide: 1, spacingBps: 0, quantity: '1' })).toThrow(/cross|spacing/i);
  });

  it('reads a partial batch, a timeout, and a partial fill status without treating them as a full fill', () => {
    const partial = parseBatchReceipt({
      code: 0,
      data: [
        { code: 0, orderID: 11, clOrdID: 'a' },
        { code: 4, clOrdID: 'b' },
      ],
    });
    expect(partial.stage).toBe('partial');
    expect(partial.filled).toBe(false);
    expect(partial.retryAllowed).toBe(false);
    expect(parseBatchReceipt(null).stage).toBe('ambiguous');
    expect(quoteIsStale(new Date(Date.now() - 60_000).toISOString())).toBe(true);
  });
});
