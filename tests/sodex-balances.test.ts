import test from 'node:test';
import assert from 'node:assert/strict';
import { marginUsd, parsePerpsBalances } from '../lib/sodex-balances.ts';

const sample = {
  code: 0,
  data: {
    blockTime: 1794916322900,
    blockHeight: 297253447,
    balances: [
      { id: 1, coin: 'vUSDC', total: '0.376792', collateral: '0.1', marginRatio: '0.9', price: '1', borrowed: '0' },
      { id: 2, coin: 'vETH', total: '0.000139', collateral: '0', marginRatio: '0.9', price: '1815.48', borrowed: '0' },
      { id: 3, coin: 'vBTC', total: '0', collateral: '0', marginRatio: '0.9', price: '90000' },
      { id: 4, coin: 'vBAD', total: '-17.08', collateral: '0', marginRatio: '0.9', price: '1815.48' },
      { id: 5, coin: 'vQQQ', total: '0.000922', collateral: '0', marginRatio: '0.8', price: '500' },
    ],
  },
};

test('parsePerpsBalances reads official fields and skips zero or negative totals', () => {
  const rows = parsePerpsBalances(sample);
  assert.deepEqual(rows.map((r) => r.coin), ['vUSDC', 'vETH', 'vQQQ']);
  assert.equal(rows[0].total, 0.376792);
  assert.equal(rows[0].collateral, 0.1);
  assert.equal(rows[1].price, 1815.48);
  assert.equal(rows[2].marginRatio, 0.8);
  assert.equal(rows.length, 3);
});

test('parsePerpsBalances accepts unwrapped data and empty payloads', () => {
  assert.deepEqual(parsePerpsBalances({ balances: [] }), []);
  assert.deepEqual(parsePerpsBalances(null), []);
  assert.deepEqual(parsePerpsBalances({ data: null }), []);
  const rows = parsePerpsBalances({ balances: [{ id: 9, coin: 'vXAUt', total: '0.000088', price: '2600' }] });
  assert.equal(rows[0].coin, 'vXAUt');
  assert.equal(rows[0].total, 0.000088);
  assert.equal(rows[0].price, 2600);
});

test('marginUsd prefers priceOf and falls back to the perps price field', () => {
  const b = { coin: 'vETH', total: 0.000139, price: 1815.48 };
  assert.ok(Math.abs(marginUsd(b, () => 3000) - 0.000139 * 3000) < 1e-12);
  assert.ok(Math.abs(marginUsd(b, () => 0) - 0.000139 * 1815.48) < 1e-12);
  assert.equal(marginUsd(b, () => NaN), 0.000139 * 1815.48);
});
