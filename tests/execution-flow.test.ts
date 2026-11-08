import { afterEach, describe, expect, it } from 'vitest';
import { buildSpotBatchParams, hashExchangePayload } from '@/lib/sodex-wallet-trade';
import { reserveNonce, resetNonceLedgerForTests } from '@/lib/nonce-ledger';
import { checkOrderFilters, isMultiple, multiplyDecimal } from '@/lib/decimal-rule';
import { parseBatchReceipt } from '@/lib/order-receipt';
import { buildCostLens, quoteIsStale, requestedAppFee } from '@/lib/cost-lens';
import { buildEvidenceTimeline } from '@/lib/evidence-timeline';
import { selfTradeCheck } from '@/lib/self-trade';
import { assertRelayOrderParams } from '@/lib/builder-order-guard';

afterEach(() => {
  resetNonceLedgerForTests();
  delete process.env.SODEX_BUILDER_ID;
  delete process.env.SODEX_BUILDER_FEE;
});

describe('spot payload', () => {
  it('keeps documented field order and omits an unrequested app fee', () => {
    const params = buildSpotBatchParams({
      accountId: 7,
      symbolId: 3,
      clOrdID: 'fs-1',
      side: 'buy',
      type: 'limit',
      quantity: '0.01',
      price: '100',
      builder: null,
    });
    expect(JSON.stringify({ type: 'batchNewOrder', params })).toBe(
      '{"type":"batchNewOrder","params":{"accountID":7,"orders":[{"symbolID":3,"clOrdID":"fs-1","side":1,"type":1,"timeInForce":1,"price":"100","quantity":"0.01"}]}}',
    );
    expect(hashExchangePayload('batchNewOrder', params)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('places the app fee last and does not change it after the hash', () => {
    const params = buildSpotBatchParams({
      accountId: 7,
      symbolId: 3,
      clOrdID: 'fs-1',
      side: 'sell',
      type: 'limit',
      quantity: '0.01',
      price: '100',
      builder: { id: 2674, fee: 10 },
    });
    const canonical = JSON.stringify({ type: 'batchNewOrder', params });
    expect(canonical.endsWith('"builder":{"id":2674,"fee":10}}}')).toBe(true);
    const hash = hashExchangePayload('batchNewOrder', params);
    expect(hashExchangePayload('batchNewOrder', params)).toBe(hash);
  });

  it('uses funds for a spot market buy and keeps the spot batch route shape', () => {
    const params = buildSpotBatchParams({
      accountId: 7,
      symbolId: 3,
      clOrdID: 'fs-m',
      side: 'buy',
      type: 'market',
      quantity: '10',
      builder: null,
    });
    expect(JSON.stringify(params)).toContain('"funds":"10"');
    expect(JSON.stringify(params)).not.toContain('quantity');
  });
});

describe('nonce and filters', () => {
  it('reserves a greater nonce for the same signer at the same millisecond', () => {
    expect(reserveNonce('0xabcabcabcabcabcabcabcabcabcabcabcabcabca', 5_000)).toBe('5000');
    expect(reserveNonce('0xabcabcabcabcabcabcabcabcabcabcabcabcabca', 5_000)).toBe('5001');
    expect(reserveNonce('0xdefdefdefdefdefdefdefdefdefdefdefdefdefa', 5_000)).toBe('5000');
  });

  it('rejects a price that misses the tick and a size under the minimum notional', () => {
    expect(isMultiple('100.5', '0.1')).toBe(true);
    expect(isMultiple('100.05', '0.1')).toBe(false);
    const checked = checkOrderFilters({
      price: '100.05',
      quantity: '0.01',
      notional: multiplyDecimal('100.05', '0.01') ?? undefined,
      filtersKnown: true,
      filters: { tickSize: '0.1', minNotional: '5' },
    });
    expect(checked.ok).toBe(false);
    expect(checked.issues.map((issue) => issue.field)).toContain('price');
  });

  it('does not invent filter failures when the symbol record has none', () => {
    expect(checkOrderFilters({ price: '1.2345', quantity: '0.1', filters: {}, filtersKnown: false }).ok).toBe(true);
  });
});

describe('receipt, cost, evidence, self-trade', () => {
  it('treats an order id as accepted and not filled', () => {
    const receipt = parseBatchReceipt({ code: 0, data: [{ code: 0, orderID: 42, clOrdID: 'fs-1' }] });
    expect(receipt.stage).toBe('accepted');
    expect(receipt.filled).toBe(false);
    expect(receipt.retryAllowed).toBe(false);
    expect(receipt.orderId).toBe('42');
  });

  it('does not allow a blind retry when the id is missing or the item is rejected', () => {
    expect(parseBatchReceipt({ code: 0, data: [{ code: 0, clOrdID: 'fs-1' }] }).stage).toBe('ambiguous');
    expect(parseBatchReceipt({ code: 0, data: [{ code: 4, clOrdID: 'fs-1' }] }).stage).toBe('rejected');
    expect(parseBatchReceipt({ code: 7 }).retryAllowed).toBe(false);
  });

  it('charges no spot-buy app fee and does not invent an exchange fee', () => {
    expect(requestedAppFee(100, 10, 'buy')).toBe(0);
    expect(requestedAppFee(100, 10, 'sell')).toBeCloseTo(0.01);
    const lens = buildCostLens({
      side: 'buy',
      type: 'limit',
      quantity: 1,
      price: 100,
      bids: [{ price: 99, qty: 2 }],
      asks: [{ price: 101, qty: 2 }],
      fetchedAt: new Date().toISOString(),
      includeAppFee: true,
      feeTenths: 10,
      exchangeFeeQuote: null,
    });
    const app = lens.lines.find((line) => line.label === 'App fee');
    const exchange = lens.lines.find((line) => line.label === 'Exchange fee');
    expect(app?.state).toBe('not-charged');
    expect(exchange?.state).toBe('unavailable');
    expect(lens.stress.some((row) => /forecast|profit|backtest/i.test(row.detail))).toBe(false);
  });

  it('marks a stale book and an empty book without a fake impact', () => {
    expect(quoteIsStale(new Date(Date.now() - 30_000).toISOString())).toBe(true);
    const lens = buildCostLens({
      side: 'sell',
      type: 'market',
      quantity: 1,
      bids: [],
      asks: [],
      fetchedAt: new Date().toISOString(),
      includeAppFee: false,
      feeTenths: 0,
    });
    expect(lens.state).toBe('unavailable');
    expect(lens.averagePrice).toBeNull();
  });

  it('blocks a cross with the same account and does not call a headline a cause', () => {
    const cross = selfTradeCheck({
      side: 'buy',
      type: 'limit',
      price: 100,
      bookKnown: true,
      resting: [{ side: 'sell', price: 100, status: 'NEW' }],
    });
    expect(cross.state).toBe('blocked');
    const timeline = buildEvidenceTimeline({
      newsFresh: true,
      headlines: [{ title: 'Flows rise', publishedAt: '2026-11-08T00:00:00.000Z' }],
      candles: [
        { t: Date.parse('2026-11-07T23:00:00.000Z'), c: 100 },
        { t: Date.parse('2026-11-08T01:00:00.000Z'), c: 101 },
      ],
      now: Date.parse('2026-11-08T02:00:00.000Z'),
    });
    expect(timeline.items[0]?.alternate.toLowerCase()).toContain('does not show');
    expect(buildEvidenceTimeline({ newsFresh: false, headlines: [], candles: [] }).state).toBe('insufficient');
  });

  it('allows a relay without an app-fee tag and rejects a mismatched tag', () => {
    process.env.SODEX_BUILDER_ID = '2674';
    process.env.SODEX_BUILDER_FEE = '10';
    process.env.SODEX_MAX_NOTIONAL_USDC = '100';
    const order = {
      symbolID: 1,
      clOrdID: 'fs-x',
      side: 1,
      type: 1,
      timeInForce: 1,
      price: '10',
      quantity: '1',
    };
    expect(assertRelayOrderParams({ accountID: 1, orders: [order] }).ok).toBe(true);
    expect(assertRelayOrderParams({ accountID: 1, orders: [order], builder: { id: 2674, fee: 99 } }).ok).toBe(false);
  });
});
