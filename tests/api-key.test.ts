import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADD_API_KEY_TYPE,
  API_KEY_TYPE_EVM,
  KEYS_AT_CAP,
  MAX_API_KEYS,
  USER_SIGNED_ADD_API_KEY_FIELDS,
  USER_SIGNED_ADD_API_KEY_TYPE,
  buildUserSignedAddApiKey,
  friendlySodexError,
  isKeyGone,
  isKeyGoneText,
  isUserRejected,
  keyListed,
  keySlots,
  looksLikeRawSodex,
  userFacingError,
  wrapUniversalSignature,
} from '../lib/sodex-keys.ts';

test('UserSignedAddAPIKeyAction field order matches the official Go type string', () => {
  const encoded = `UserSignedAddAPIKeyAction(${USER_SIGNED_ADD_API_KEY_FIELDS.map((f) => `${f.type} ${f.name}`).join(',')})`;
  assert.equal(encoded, USER_SIGNED_ADD_API_KEY_TYPE);
  assert.equal(
    USER_SIGNED_ADD_API_KEY_TYPE,
    'UserSignedAddAPIKeyAction(uint64 chainID,uint64 nonce,uint64 accountID,string name,uint8 keyType,bytes publicKey,uint64 expiresAt)',
  );
  assert.equal(
    ADD_API_KEY_TYPE,
    'AddAPIKey(uint64 accountID,string name,uint8 keyType,bytes publicKey,uint64 expiresAt,uint64 nonce)',
  );
});

test('wallet-signed registration payload uses the official user-signed form, not plain AddAPIKey', () => {
  const { typedData, body, headers } = buildUserSignedAddApiKey({
    sodexChainId: 286623,
    signatureChainId: 1, // wallet on Ethereum
    accountID: 1010,
    name: 'api-key-01',
    publicKey: '0x3D4595C8742D0A58173A9963C05755B59A8F8256',
    expiresAt: 0,
    nonce: 1760373925000,
  });
  assert.equal(typedData.primaryType, 'UserSignedAddAPIKeyAction');
  assert.equal(typedData.domain.name, 'universal');
  assert.equal(typedData.domain.version, '1');
  assert.equal(typedData.domain.chainId, 1);
  assert.equal(typedData.domain.verifyingContract, '0x0000000000000000000000000000000000000000');
  assert.deepEqual(typedData.message, {
    chainID: '286623',
    nonce: '1760373925000',
    accountID: '1010',
    name: 'api-key-01',
    keyType: API_KEY_TYPE_EVM,
    publicKey: '0x3d4595c8742d0a58173a9963c05755b59a8f8256',
    expiresAt: '0',
  });
  assert.deepEqual(body, {
    accountID: 1010,
    name: 'api-key-01',
    type: 1,
    publicKey: '0x3d4595c8742d0a58173a9963c05755b59a8f8256',
    expiresAt: 0,
  });
  assert.equal(headers['X-API-Chain'], '1');
  assert.equal(headers['X-API-Nonce'], '1760373925000');
  assert.equal((headers as any)['X-API-Key'], undefined);
});

test('wrapUniversalSignature prepends 0x02 and normalizes v 27/28 to 0/1', () => {
  const r = 'aa'.repeat(32);
  const s = 'bb'.repeat(32);
  assert.equal(wrapUniversalSignature('0x' + r + s + '1b'), '0x02' + r + s + '00');
  assert.equal(wrapUniversalSignature('0x' + r + s + '1c'), '0x02' + r + s + '01');
  assert.equal(wrapUniversalSignature('0x' + r + s + '00'), '0x02' + r + s + '00');
  assert.equal(wrapUniversalSignature('0x' + r + s + '01'), '0x02' + r + s + '01');
  assert.throws(() => wrapUniversalSignature('0x' + r));
});

test('raw SoDEX errors are mapped and never shown as-is', () => {
  assert.equal(
    friendlySodexError('spot: API key error: API key not found'),
    'Your trading session has ended. Tap Enable trading to start a new one, then try again.',
  );
  assert.match(friendlySodexError('account has reached maximum number of API keys'), /10 API keys/);
  assert.equal(friendlySodexError('account has reached maximum number of API keys'), KEYS_AT_CAP);
  assert.ok(!looksLikeRawSodex(friendlySodexError('spot: API key error: API key not found')));
  assert.ok(looksLikeRawSodex('spot: API key error: API key not found'));
  assert.ok(isKeyGoneText('spot: API key error: API key not found'));
  assert.ok(isKeyGone({ raw: 'spot: API key error: API key not found', message: 'friendly' }));
  assert.equal(userFacingError({ message: 'spot: API key error: API key not found' }).includes('spot:'), false);
});

test('only a real wallet Reject is treated as user rejection', () => {
  assert.equal(isUserRejected({ code: 4001, message: 'User rejected the request.' }), true);
  assert.equal(isUserRejected({ code: 4001, message: 'chainId mismatch' }), false);
  assert.equal(isUserRejected({ code: 4001, message: 'Requested network does not match' }), false);
  assert.equal(isUserRejected({ code: -32603, message: 'Internal error' }), false);
  assert.equal(userFacingError({ code: 4001, message: 'User rejected the request.' }), 'Signature was rejected in the wallet.');
});

test('an account is at the 10-key cap when either engine is full', () => {
  assert.equal(MAX_API_KEYS, 10);
  const nine = Array.from({ length: 9 }, (_, i) => ({ name: `k${i}` }));
  const ten = [...nine, { name: 'k9' }];
  assert.equal(keySlots({ spot: nine, perps: nine }).full, false);
  assert.equal(keySlots({ spot: ten, perps: nine }).full, true);
  assert.equal(keySlots({ spot: nine, perps: ten }).used, 10);
  assert.equal(keyListed({ spot: [{ name: 'soswap-ab' }], perps: [] }, 'soswap-ab'), true);
  assert.equal(keyListed({ spot: [], perps: [] }, 'soswap-ab'), false);
});

test('friendlySodexError: only real shortages claim a balance problem', () => {
  assert.match(friendlySodexError('insufficient margin'), /Not enough balance/);
  assert.match(friendlySodexError('order exceeds available balance'), /Not enough balance/);
  assert.doesNotMatch(friendlySodexError('account balance record not found'), /Not enough balance/);
  assert.doesNotMatch(friendlySodexError('margin mode cannot change'), /Not enough balance/);
});

import {
  FEE_APPROVAL_ALREADY, KeyCapError, feeAlreadyApproved, feeApprovalFailure, findListedKeyByAddress,
  isKeyCapText, keyExpiryMs, keyRegistered, parseKeyCap, soswapKeyNames, storedKeyUsable,
} from '../lib/sodex-keys.ts';

test('SoDEX "Already have 5 keys" is recognised, parsed and mapped to a friendly message', () => {
  const raw = 'Failed to create new key: Already have 5 keys. Please remove some keys before creating a new one.';
  assert.ok(isKeyCapText(raw));
  assert.equal(parseKeyCap(raw), 5);
  assert.match(friendlySodexError(raw), /already has 5 API keys/);
  assert.ok(!looksLikeRawSodex(friendlySodexError(raw)));
  assert.equal(isKeyCapText('API key not found'), false);
  assert.equal(parseKeyCap('nothing here'), null);
});

test('KeyCapError explains the situation and never carries key material', () => {
  const e = new KeyCapError(5, ['soswap-ab12cd34', 'soswap-ef56gh78']);
  assert.match(e.message, /5 API keys/);
  assert.match(e.message, /soswap-ab12cd34/);
  assert.match(e.message, /cannot be recovered/);
  assert.match(e.message, /Import \/ Reconnect/);
  assert.ok(!/0x[0-9a-f]{20,}/i.test(e.message));
});

const KEY = { name: 'soswap-ab12cd34', pk: '0x' + '11'.repeat(32), address: '0x' + 'ab'.repeat(20), accountID: 7, expiresAt: 10_000_000, net: 'mainnet', owner: '0xowner' };
const CTX = { owner: '0xowner', net: 'mainnet', accountID: 7, now: 1_000_000 };

test('a stored key is reusable only for the same wallet, network and account and while not expiring', () => {
  assert.equal(storedKeyUsable(KEY, CTX), true);
  assert.equal(storedKeyUsable(null, CTX), false);
  assert.equal(storedKeyUsable(KEY, { ...CTX, owner: '0xother' }), false);
  assert.equal(storedKeyUsable(KEY, { ...CTX, net: 'testnet' }), false);
  assert.equal(storedKeyUsable(KEY, { ...CTX, accountID: 8 }), false);
  assert.equal(storedKeyUsable(KEY, { ...CTX, accountID: null }), false);
  assert.equal(storedKeyUsable(KEY, { ...CTX, now: 9_990_000 }), false, 'within 30s of expiry');
  assert.equal(storedKeyUsable({ ...KEY, pk: '' }, CTX), false);
});

test('keyRegistered distinguishes listed, revoked and unknown', () => {
  const listed = { spot: [{ name: 'other', publicKey: '0x' + 'ab'.repeat(20).toUpperCase() }], perps: [] };
  assert.equal(keyRegistered(listed, KEY), true, 'matched by public address, case-insensitive');
  assert.equal(keyRegistered({ spot: [{ name: 'soswap-ab12cd34' }], perps: [] }, KEY), true, 'matched by name');
  assert.equal(keyRegistered({ spot: [{ name: 'x' }], perps: [] }, KEY), false);
  assert.equal(keyRegistered(null, KEY), undefined);
  assert.equal(findListedKeyByAddress(listed, KEY.address)?.name, 'other');
  assert.deepEqual(soswapKeyNames({ spot: [{ name: 'soswap-a' }, { name: 'mine' }], perps: [{ name: 'soswap-a' }, { name: 'soswap-b' }] }), ['soswap-a', 'soswap-b']);
  assert.equal(keyExpiryMs(1_800_000_000), 1_800_000_000_000);
  assert.equal(keyExpiryMs(1_800_000_000_000), 1_800_000_000_000);
  assert.equal(keyExpiryMs(0), undefined);
  assert.equal(keyExpiryMs('x'), undefined);
});

test('fee approval: existing approval is detected, -1 gets a clear retry message', () => {
  assert.equal(feeAlreadyApproved(30, 30), true);
  assert.equal(feeAlreadyApproved(50, 30), true);
  assert.equal(feeAlreadyApproved(10, 30), false);
  assert.equal(feeAlreadyApproved(0, 30), false);
  assert.equal(feeAlreadyApproved(NaN, 30), false);
  assert.match(FEE_APPROVAL_ALREADY, /already approved/);
  const m1 = feeApprovalFailure(-1, 'spot: some raw error');
  assert.match(m1, /did not confirm/);
  assert.match(m1, /Nothing was charged/);
  assert.match(m1, /tap Approve again/);
  assert.match(m1, /code: -1/);
  assert.ok(!m1.includes('some raw error'), 'raw text hidden unless debug');
  assert.match(feeApprovalFailure(-1, 'oops', true), /Details for support: oops/);
  assert.match(feeApprovalFailure(400, 'bad'), /did not accept.*code if it repeats: 400/);
  assert.doesNotMatch(feeApprovalFailure(-1, 'insufficient margin'), /Not enough balance/);
});
