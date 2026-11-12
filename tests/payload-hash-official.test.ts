/**
 * payloadHash against the official SoDEX docs examples (on disk at
 * flowsentinel-reference-upgrade/sodex-authentication-and-signing.md and
 * sodex-spot-trading.md). Field order comes from the builders, never from
 * key sorting.
 */
import { describe, expect, it } from 'vitest';
import { keccak256, recoverTypedDataAddress, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { buildSpotBatchParams, hashExchangePayload } from '@/lib/sodex-wallet-trade';
import { normalPerpsOrder, perpsNewOrderParams } from '@/lib/sodex-perps-order';
import { buildSpotExchangeTypedData } from '@/lib/sodex-builder';
import { walkDepth } from '@/lib/depth-walk';
import { mapSectorSpotlight } from '@/lib/sosovalue';

// Verbatim from "How to compute payloadHash" -> "perps market buy order signing payload".
const OFFICIAL_PERPS_PAYLOAD =
  '{"type":"newOrder","params":{"accountID":12345,"symbolID":1,"orders":[{"clOrdID":"my-order-1","modifier":1,"side":1,"type":2,"timeInForce":3,"quantity":"0.001","reduceOnly":false,"positionSide":1}]}}';
const OFFICIAL_PERPS_HASH = keccak256(toHex(OFFICIAL_PERPS_PAYLOAD));

describe('payloadHash matches the official SoDEX example', () => {
  it('perps builder reproduces the documented payload byte-for-byte', () => {
    const params = perpsNewOrderParams({
      accountId: 12345,
      symbolId: 1,
      orders: [normalPerpsOrder({ clOrdID: 'my-order-1', side: 'buy', type: 'market', quantity: '0.001' })],
      builder: null,
    });
    expect(JSON.stringify({ type: 'newOrder', params })).toBe(OFFICIAL_PERPS_PAYLOAD);
    expect(hashExchangePayload('newOrder', params)).toBe(OFFICIAL_PERPS_HASH);
    expect(OFFICIAL_PERPS_HASH).toBe('0x24d973a9f714c68e80bf214cbd6a39798da4022b17d43719ec6017f19f4685a7');
  });

  it('a reordered key set changes the hash (no generic sorting)', () => {
    const sorted = '{"params":{"accountID":12345,"orders":[],"symbolID":1},"type":"newOrder"}';
    expect(keccak256(toHex(sorted))).not.toBe(OFFICIAL_PERPS_HASH);
  });

  it('spot batch keeps the documented field order from the spot example', () => {
    const params = buildSpotBatchParams({
      accountId: 1010,
      symbolId: 7,
      clOrdID: 'spot-1760373925000',
      side: 'buy',
      type: 'limit',
      price: '65000.5',
      quantity: '0.0002',
      builder: null,
    });
    expect(JSON.stringify({ type: 'batchNewOrder', params })).toBe(
      '{"type":"batchNewOrder","params":{"accountID":1010,"orders":[{"symbolID":7,"clOrdID":"spot-1760373925000","side":1,"type":1,"timeInForce":1,"price":"65000.5","quantity":"0.0002"}]}}',
    );
  });

  it('decimal fields are strings and unset optional fields are omitted', () => {
    const params = buildSpotBatchParams({
      accountId: 1,
      symbolId: 2,
      clOrdID: 'm',
      side: 'buy',
      type: 'market',
      quantity: '25',
      builder: null,
    });
    const order = (params.orders as Array<Record<string, unknown>>)[0];
    expect(order.funds).toBe('25');
    expect('price' in order).toBe(false);
    expect('quantity' in order).toBe(false);
    expect('builder' in params).toBe(false);
  });

  it('typed data uses the official ExchangeAction domain for spot mainnet', async () => {
    const typed = buildSpotExchangeTypedData({ network: 'mainnet', payloadHash: OFFICIAL_PERPS_HASH, nonce: BigInt('1760373925001') });
    expect(typed.domain).toEqual({
      name: 'spot',
      version: '1',
      chainId: 286623,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    });
    expect(typed.primaryType).toBe('ExchangeAction');
    expect(typed.types.ExchangeAction).toEqual([
      { name: 'payloadHash', type: 'bytes32' },
      { name: 'nonce', type: 'uint64' },
    ]);
    // Throwaway test key from the docs (0x2222…). The docs pair it with an
    // illustrative address that it does not derive to, so only round-trip here.
    const docKey = privateKeyToAccount(`0x${'22'.repeat(32)}`);
    const sig = await docKey.signTypedData(typed);
    const signer = await recoverTypedDataAddress({ ...typed, signature: sig });
    expect(signer).toBe(docKey.address);
  });
});

describe('depth walk', () => {
  const asks = [
    { price: 100, qty: 1 },
    { price: 101, qty: 2 },
    { price: 103, qty: 5 },
  ];
  const bids = [{ price: 99, qty: 3 }];

  it('walks asks for a market buy by quote funds', () => {
    const walk = walkDepth({ side: 'buy', type: 'market', size: 302, bids, asks });
    expect(walk.rows[0].taken).toBe(1);
    expect(walk.rows[1].taken).toBe(2);
    expect(walk.complete).toBe(true);
    expect(walk.slippageBps).toBeGreaterThan(0);
  });

  it('stops at the limit price and reports the resting remainder', () => {
    const walk = walkDepth({ side: 'buy', type: 'limit', size: 4, limitPrice: 101, bids, asks });
    expect(walk.filledBase).toBe(3);
    expect(walk.remainder).toBe(1);
    expect(walk.complete).toBe(false);
  });

  it('returns an honest empty walk without a book', () => {
    const walk = walkDepth({ side: 'sell', type: 'market', size: 1, bids: [], asks });
    expect(walk.rows).toEqual([]);
    expect(walk.averagePrice).toBeNull();
  });
});

describe('sector spotlight mapping', () => {
  it('maps the documented response shape', () => {
    const out = mapSectorSpotlight({
      sector: [{ name: 'btc', '24h_change_pct': -0.0012, marketcap_dom: 0.58 }],
      spotlight: [{ name: 'perpdex', '24h_change_pct': -0.0012 }],
    });
    expect(out.sectors).toEqual([{ name: 'btc', changePct24h: -0.0012, dominance: 0.58 }]);
    expect(out.spotlight[0].dominance).toBeNull();
    expect(mapSectorSpotlight({ sector: [{ name: ' DeFi', change_pct_24h: -0.0239, marketcap_dom: 0.0181 }] }).sectors[0]).toEqual({
      name: 'DeFi',
      changePct24h: -0.0239,
      dominance: 0.0181,
    });
    expect(mapSectorSpotlight(null)).toEqual({ sectors: [], spotlight: [] });
  });
});
