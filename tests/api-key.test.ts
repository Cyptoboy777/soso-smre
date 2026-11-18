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
