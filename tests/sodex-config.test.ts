import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SODEX_ASSETS, STABLECOINS, bestDestination, cheapestWithdraw, findAsset,
  isAllowedDestination, minDepositGate, totalWithdrawFee,
} from '../lib/sodexConfig.ts';
import { fromSmallest, toSmallest } from '../lib/routes/amount.ts';

test('every SoDEX config row has a positive minDeposit (per official table)', () => {
  assert.equal(SODEX_ASSETS.length, 46);
  for (const row of SODEX_ASSETS) {
    assert.ok(row.minDeposit > 0, `${row.token} on ${row.chain} minDeposit`);
    assert.ok(row.minWithdraw > 0, `${row.token} on ${row.chain} minWithdraw`);
    assert.ok(row.withdrawFee >= 0 && row.bridgeWithdrawFee >= 0);
    assert.ok(row.token && row.chain);
  }
});

test('official sample rows match the SoDEX table', () => {
  const usdcEth = findAsset('USDC', 'ETH');
  assert.deepEqual(usdcEth, { token: 'USDC', chain: 'ETH', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 5 });
  const usdcMatic = findAsset('USDC', 'MATIC');
  assert.equal(usdcMatic?.minWithdraw, 2);
  const ethBase = findAsset('ETH', 'BASE');
  assert.equal(ethBase?.minDeposit, 0.002);
  const ethArb = findAsset('ETH', 'ARBITRUM');
  assert.equal(ethArb?.minDeposit, 0.0015);
  const smag = findAsset('sMAG7.ssi', 'BASE');
  assert.equal(smag?.bridgeWithdrawFee, 0.5);
});

test('min-deposit gate blocks amounts below the official minimum', () => {
  const blocked = minDepositGate({ token: 'USDC', chain: 'BASE', amount: 4.99 });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.reason, 'below-min');
  const ok = minDepositGate({ token: 'USDC', chain: 'BASE', amount: 5 });
  assert.equal(ok.ok, true);
  const eth = minDepositGate({ token: 'ETH', chain: 'ETH', amount: 0.001 });
  assert.equal(eth.ok, false);
});

test('stablecoins also need about $5 when a USD estimate is supplied', () => {
  const blocked = minDepositGate({ token: 'USDC', chain: 'BASE', amount: 5, usdApprox: 4.5 });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.reason, 'below-stable-usd');
  const ok = minDepositGate({ token: 'USDC', chain: 'BASE', amount: 5, usdApprox: 5 });
  assert.equal(ok.ok, true);
  assert.ok(STABLECOINS.has('USDT'));
});

test('unsupported destination pairs are rejected', () => {
  assert.equal(isAllowedDestination('USDC', 'DOGE'), false);
  const gate = minDepositGate({ token: 'USDC', chain: 'DOGE', amount: 100 });
  assert.equal(gate.ok, false);
  if (!gate.ok) {
    assert.equal(gate.reason, 'unsupported');
    assert.match(gate.message, /SoDEX will not credit this/);
  }
});

test('best destination prefers a direct SoDEX deposit when the source pair is listed', () => {
  const direct = bestDestination('USDC', 'BASE', true);
  assert.equal(direct.kind, 'direct');
  if (direct.kind === 'direct') assert.equal(direct.asset.chain, 'BASE');
});

test('best destination stays on an EVM SoDEX chain for an Ethereum wallet', () => {
  const sol = bestDestination('SOL', 'SOL', true);
  assert.equal(sol.kind, 'route');
  if (sol.kind === 'route') {
    assert.equal(sol.asset.token, 'USDC');
    assert.equal(sol.asset.chain, 'BASE');
  }
  const usdtMatic = bestDestination('USDT', 'MATIC', true);
  assert.equal(usdtMatic.kind, 'route');
  if (usdtMatic.kind === 'route') assert.equal(usdtMatic.asset.token, 'USDT');
});

test('cheapest withdrawal picks the lowest official fee, then the lowest minimum', () => {
  const usdt = cheapestWithdraw('USDT');
  assert.ok(usdt);
  assert.equal(totalWithdrawFee(usdt!), 1);
  assert.equal(usdt!.minWithdraw, 2);
  assert.ok(usdt!.chain === 'ARBITRUM' || usdt!.chain === 'BSC_BNB' || usdt!.chain === 'SOL');
  const eth = cheapestWithdraw('ETH');
  assert.equal(eth?.chain, 'BASE');
  assert.equal(eth?.minWithdraw, 0.0005);
  assert.equal(cheapestWithdraw('NOTATOKEN'), null);
});

test('amount conversion is exact for typical decimal counts', () => {
  assert.equal(toSmallest('5', 6), '5000000');
  assert.equal(toSmallest('0.002', 18), '2000000000000000');
  assert.equal(toSmallest('1.23', 6), '1230000');
  assert.equal(toSmallest('1.2345678', 6), null);
  assert.equal(fromSmallest('9800000', 6), '9.8');
  assert.equal(fromSmallest('2000000000000000', 18), '0.002');
});
