import test from 'node:test';
import assert from 'node:assert/strict';
import {
  amountForPercent,
  quoteFeeBuffer,
  QUOTE_FEE_BUFFER_BPS,
  QUOTE_FEE_BUFFER_MIN,
  priceMovePct,
  shouldWarnPriceMove,
  readRecentPairs,
  pushRecentPair,
  normalizeRecentPair,
  formatPriceMove,
} from '../lib/swap-ux.ts';

test('25% and 50% of a base coin floor to the lot step', () => {
  assert.equal(amountForPercent({ available: 1.237, fraction: 0.25, isQuote: false, step: '0.001' }), '0.309');
  assert.equal(amountForPercent({ available: 1.237, fraction: 0.5, isQuote: false, step: '0.001' }), '0.618');
});

test('MAX of a base coin floors to the step and never exceeds available', () => {
  assert.equal(amountForPercent({ available: 0.40609, fraction: 1, isQuote: false, step: '0.0001' }), '0.406');
  const max = amountForPercent({ available: 0.000139, fraction: 1, isQuote: false, step: '0.000001' });
  assert.equal(max, '0.000139');
  assert.ok(Number(max) <= 0.000139);
});

test('MAX of a quote coin with the fee buffer leaves a little and floors to 6 decimals', () => {
  const avail = 10;
  const buf = quoteFeeBuffer(avail);
  assert.equal(buf, Math.max(QUOTE_FEE_BUFFER_MIN, avail * (QUOTE_FEE_BUFFER_BPS / 10_000)));
  const max = amountForPercent({ available: avail, fraction: 1, isQuote: true, leaveFeeBuffer: true });
  assert.equal(max, '9.99');
  assert.ok(Number(max) < avail);
  assert.equal(amountForPercent({ available: avail, fraction: 1, isQuote: true, leaveFeeBuffer: false }), '10');
});

test('25% of a quote coin does not apply the fee buffer', () => {
  assert.equal(amountForPercent({ available: 10, fraction: 0.25, isQuote: true, leaveFeeBuffer: true }), '2.5');
});

test('chips use only the available amount passed in (total − locked)', () => {
  const available = 2; // locked portion already subtracted by the caller
  assert.equal(amountForPercent({ available, fraction: 1, isQuote: true, leaveFeeBuffer: false }), '2');
  assert.equal(amountForPercent({ available: 0, fraction: 1, isQuote: true, leaveFeeBuffer: true }), '0');
});

test('quote MAX with a tiny balance still floors and never goes negative', () => {
  assert.equal(amountForPercent({ available: 0.005, fraction: 1, isQuote: true, leaveFeeBuffer: true }), '0');
  assert.equal(amountForPercent({ available: 0.02, fraction: 1, isQuote: true, leaveFeeBuffer: true }), '0.01');
});

test('price-move threshold is a strict greater-than on slippage', () => {
  // 100 → 100.5 is exactly 0.5%
  assert.equal(priceMovePct(100, 100.5).toFixed(4), '0.5000');
  assert.equal(shouldWarnPriceMove(100, 100.5, 0.5), false);
  assert.equal(shouldWarnPriceMove(100, 100.51, 0.5), true);
  assert.equal(shouldWarnPriceMove(100, 99.4, 0.5), true);
  assert.equal(shouldWarnPriceMove(100, 99.6, 0.5), false);
});

test('price-move helpers ignore zero or invalid rates', () => {
  assert.equal(priceMovePct(0, 1), 0);
  assert.equal(priceMovePct(1, 0), 0);
  assert.equal(shouldWarnPriceMove(NaN, 1, 0.5), false);
  assert.match(formatPriceMove(0.82), /Price moved 0\.82%\. Re-check before signing\?/);
});

test('recent pairs keep the last 3, most recent first, and dedupe', () => {
  let list = pushRecentPair([], 'USDC', 'BTC');
  list = pushRecentPair(list, 'ETH', 'USDC');
  list = pushRecentPair(list, 'SOL', 'USDC');
  list = pushRecentPair(list, 'BTC', 'USDC');
  assert.deepEqual(list, [
    { from: 'BTC', to: 'USDC' },
    { from: 'SOL', to: 'USDC' },
    { from: 'ETH', to: 'USDC' },
  ]);
  list = pushRecentPair(list, 'SOL', 'USDC');
  assert.deepEqual(list[0], { from: 'SOL', to: 'USDC' });
  assert.equal(list.length, 3);
  assert.equal(list.filter((p) => p.from === 'SOL' && p.to === 'USDC').length, 1);
});

test('recent pairs storage rejects wallet addresses and drops extra fields', () => {
  assert.equal(normalizeRecentPair({ from: '0xd9d3abcabcabcabcabcabcabcabcabcabc7833', to: 'BTC' }), null);
  assert.equal(normalizeRecentPair({ from: 'USDC', to: '0x0123456789abcdef0123456789abcdef01234567' }), null);
  const cleaned = readRecentPairs([
    { from: 'USDC', to: 'BTC' },
    { from: '0x0123456789abcdef0123456789abcdef01234567', to: 'ETH' },
    { wallet: '0xd9d3abcabcabcabcabcabcabcabcabcabc7833', from: 'USDC', to: 'ETH' },
    'nope',
    { from: 'USDC', to: 'USDC' },
  ]);
  assert.deepEqual(cleaned, [{ from: 'USDC', to: 'BTC' }, { from: 'USDC', to: 'ETH' }]);
  const blob = JSON.stringify(cleaned);
  assert.ok(!blob.includes('0x'));
  assert.ok(!blob.includes('wallet'));
  assert.equal(pushRecentPair([], '0x0123456789abcdef0123456789abcdef01234567', 'BTC').length, 0);
});
