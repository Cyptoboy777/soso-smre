import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSwapCommand } from '../lib/voice-command.ts';

test('swap phrasing', () => {
  assert.deepEqual(parseSwapCommand('swap 10 USDC to ETH'), { from: 'USDC', to: 'ETH', amount: '10' });
  assert.deepEqual(parseSwapCommand('Convert 0.5 eth into usdc.'), { from: 'ETH', to: 'USDC', amount: '0.5' });
  assert.deepEqual(parseSwapCommand('exchange 2,5 sol for btc'), { from: 'SOL', to: 'BTC', amount: '2.5' });
  assert.deepEqual(parseSwapCommand('swap ten USDC to BTC'), { from: 'USDC', to: 'BTC', amount: '10' });
});
test('buy and sell phrasing', () => {
  assert.deepEqual(parseSwapCommand('buy 50 dollars of bitcoin'), { from: 'USDC', to: 'BTC', amount: '50' });
  assert.deepEqual(parseSwapCommand('buy 25 ETH'), { from: 'USDC', to: 'ETH', amount: '25' });
  assert.deepEqual(parseSwapCommand('buy BTC with 100 USDC'), { from: 'USDC', to: 'BTC', amount: '100' });
  assert.deepEqual(parseSwapCommand('sell 0.1 BTC'), { from: 'BTC', to: 'USDC', amount: '0.1' });
});
test('anything else is left to the assistant', () => {
  assert.equal(parseSwapCommand('what is slippage'), null);
  assert.equal(parseSwapCommand('swap USDC to ETH'), null);
  assert.equal(parseSwapCommand('swap 0 USDC to ETH'), null);
  assert.equal(parseSwapCommand('swap 5 ETH to ETH'), null);
  assert.equal(parseSwapCommand('should I buy 5 ETH or sell it and why would the price change'), null);
  assert.equal(parseSwapCommand('x'.repeat(200)), null);
});
