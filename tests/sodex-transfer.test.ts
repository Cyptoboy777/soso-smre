import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPOT_WITHDRAW,
  SPOT_WITHDRAW_TO_ACCOUNT_ID,
  TRANSFER_ASSET_ACTION,
  FUTURES_DOMAIN,
  buildTransferAssetParams,
  transferAssetBodyJson,
  transferAssetPayloadJson,
  transferAssetTypedData,
  canonicalDecimal,
  floorToPrecision,
  compareDecimal,
  validateMoveToSpot,
  friendlyTransferError,
} from '../lib/sodex-transfer.ts';
import { parsePerpsState } from '../lib/sodex-balances.ts';

test('canonicalDecimal matches shopspring/decimal JSON style', () => {
  assert.equal(canonicalDecimal('0.10'), '0.1');
  assert.equal(canonicalDecimal('00123'), '123');
  assert.equal(canonicalDecimal('32.100'), '32.1');
  assert.equal(canonicalDecimal('0.500'), '0.5');
  assert.equal(canonicalDecimal('001.230'), '1.23');
  assert.equal(canonicalDecimal('+32.1'), null);
  assert.equal(canonicalDecimal('1.234e+2'), null);
  assert.equal(canonicalDecimal('-1'), null);
  assert.equal(canonicalDecimal(''), null);
});

test('MAX floors to coin precision and never uses a larger total', () => {
  assert.equal(floorToPrecision('0.37679299', 6), '0.376792');
  assert.equal(floorToPrecision('0.000139', 6), '0.000139');
  assert.equal(floorToPrecision('1.999', 0), '1');
  assert.equal(floorToPrecision('0.0000001', 6), '0');
  assert.equal(compareDecimal('0.376792', '0.37679299')! < 0, true);
});

test('validateMoveToSpot uses available-for-transfer, not total, and floors the amount', () => {
  const available = '0.000045';
  const ok = validateMoveToSpot({ amount: '0.0000459', available, precision: 6 });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.amount, '0.000045');

  const tooBig = validateMoveToSpot({ amount: '0.000139', available, precision: 6 });
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.match(tooBig.message, /most you can move is 0\.000045/);

  const zeroAvail = validateMoveToSpot({ amount: '0.1', available: '0', precision: 6 });
  assert.equal(zeroAvail.ok, false);
  if (!zeroAvail.ok) assert.match(zeroAvail.message, /holding this as margin/);

  const zeroAmt = validateMoveToSpot({ amount: '0', available: '1', precision: 6 });
  assert.equal(zeroAmt.ok, false);
  if (!zeroAmt.ok) assert.match(zeroAmt.message, /greater than zero/);

  const dust = validateMoveToSpot({ amount: '0.0000004', available: '1', precision: 6 });
  assert.equal(dust.ok, false);
  if (!dust.ok) assert.match(dust.message, /greater than zero/);
});

test('payload field order matches the official Go TransferAssetRequest and ActionPayload tags', () => {
  const params = buildTransferAssetParams({
    id: 1794920000001,
    fromAccountID: 1010,
    coinID: 2,
    amount: '0.00004500',
  });
  assert.deepEqual(Object.keys(params), ['id', 'fromAccountID', 'toAccountID', 'coinID', 'amount', 'type']);
  assert.equal(params.toAccountID, SPOT_WITHDRAW_TO_ACCOUNT_ID);
  assert.equal(params.type, SPOT_WITHDRAW);
  assert.equal(params.amount, '0.000045');
  assert.equal(
    transferAssetBodyJson(params),
    '{"id":1794920000001,"fromAccountID":1010,"toAccountID":999,"coinID":2,"amount":"0.000045","type":5}',
  );
  const payload = transferAssetPayloadJson(params);
  assert.equal(
    payload,
    '{"type":"transferAsset","params":{"id":1794920000001,"fromAccountID":1010,"toAccountID":999,"coinID":2,"amount":"0.000045","type":5}}',
  );
  assert.equal(JSON.parse(payload).type, TRANSFER_ASSET_ACTION);
  // Body JSON is a prefix-compatible official params object; HTTP body is params only.
  assert.equal(payload.startsWith(`{"type":"${TRANSFER_ASSET_ACTION}","params":`), true);
});

test('digest shape uses official ExchangeAction on the futures domain (no published transfer vector)', () => {
  const params = buildTransferAssetParams({
    id: 1794920000001,
    fromAccountID: 1010,
    coinID: 2,
    amount: '0.000045',
  });
  // Official payloadHash is keccak256(ActionPayload JSON). SoDEX did not publish a transfer digest vector,
  // so this pins the typed-data shape from evm_signer.go / Authentication & Signing.
  const payloadHash = '0x' + 'ab'.repeat(32);
  assert.equal(transferAssetPayloadJson(params).includes('"type":"transferAsset"'), true);
  const typed = transferAssetTypedData({ chainId: 286623, payloadHash, nonce: 1794920000002 });
  assert.equal(typed.primaryType, 'ExchangeAction');
  assert.equal(typed.domain.name, FUTURES_DOMAIN);
  assert.equal(typed.domain.version, '1');
  assert.equal(typed.domain.chainId, 286623);
  assert.deepEqual(typed.types.ExchangeAction, [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint64' },
  ]);
  assert.equal(typed.message.payloadHash, payloadHash);
  assert.equal(typed.message.nonce, '1794920000002');
});

test('buildTransferAssetParams refuses guessed account ids or types', () => {
  assert.throws(() => buildTransferAssetParams({ id: 1, fromAccountID: 0, coinID: 2, amount: '1' }), /account/);
  assert.throws(() => buildTransferAssetParams({ id: 1, fromAccountID: 10, coinID: 2, amount: '1', toAccountID: 10 }), /Only a move/);
  assert.throws(() => buildTransferAssetParams({ id: 1, fromAccountID: 10, coinID: 2, amount: '1', type: 4 }), /Only a move/);
});

test('parsePerpsState reads aid and per-coin at, and does not treat amw as a coin max', () => {
  const state = parsePerpsState({
    code: 0,
    data: {
      aid: 4242,
      amw: '12.5',
      B: [
        { i: 1, a: 'vUSDC', wb: '0.376792', at: '0.100000', px: '1', mr: '1', co: '0' },
        { i: 2, a: 'vETH', wb: '0.000139', at: '0.000045', px: '3000', mr: '0.9', co: '0' },
        { i: 3, a: 'vBTC', wb: '0', at: '0', px: '90000' },
      ],
    },
  });
  assert.equal(state.accountID, 4242);
  assert.equal(state.amw, '12.5');
  assert.deepEqual(state.balances.map((b) => [b.coin, b.available, b.total]), [
    ['vUSDC', '0.1', 0.376792],
    ['vETH', '0.000045', 0.000139],
  ]);
  assert.notEqual(state.amw, state.balances[0].available);
});

test('friendly transfer errors never expose raw SoDEX text', () => {
  assert.equal(friendlyTransferError('perps: margin check failed'), 'SoDEX kept this amount as margin. Try a smaller amount.');
  assert.equal(friendlyTransferError('insufficient available balance'), 'SoDEX kept this amount as margin. Try a smaller amount.');
  assert.equal(friendlyTransferError('spot: something unexpected'), 'SoDEX could not complete this transfer. Please try again.');
});
