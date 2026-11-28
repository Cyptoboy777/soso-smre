import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyWallets, mergeWallets, nameFromFlags, sameWallet, type DetectedWallet } from '../lib/wallet-detect.ts';

const prov = (flags: Record<string, unknown> = {}) => ({ request: async () => [], ...flags });

test('flags name the wallet; wallets that also claim isMetaMask are not called MetaMask', () => {
  assert.equal(nameFromFlags({ isMetaMask: true, isRabby: true }).name, 'Rabby');
  assert.equal(nameFromFlags({ isMetaMask: true, isBraveWallet: true }).name, 'Brave Wallet');
  assert.equal(nameFromFlags({ isMetaMask: true }).name, 'MetaMask');
  assert.equal(nameFromFlags({}).name, 'Browser wallet');
});

test('legacy scan reads window.ethereum.providers and known globals without duplicates', () => {
  const mm = prov({ isMetaMask: true }), cb = prov({ isCoinbaseWallet: true }), okx = prov({ isOkxWallet: true });
  const win = { ethereum: { ...prov(), providers: [mm, cb] }, okxwallet: okx, phantom: { ethereum: prov({ isPhantom: true }) } };
  const ids = legacyWallets(win).map((w) => w.id).sort();
  assert.ok(ids.includes('legacy.metamask') && ids.includes('legacy.coinbase') && ids.includes('legacy.okx') && ids.includes('legacy.phantom'));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(legacyWallets({}), []);
  assert.deepEqual(legacyWallets({ ethereum: {} }), []);
});

test('announced wallets win over the same wallet found through legacy flags', () => {
  const announced: DetectedWallet[] = [{ id: 'io.metamask', name: 'MetaMask', provider: prov() }];
  const merged = mergeWallets(announced, legacyWallets({ ethereum: prov({ isMetaMask: true }), okxwallet: prov({ isOkxWallet: true }) }));
  assert.deepEqual(merged.map((w) => w.name), ['MetaMask', 'OKX Wallet']);
});

test('a generic browser wallet is shown only when nothing else was found', () => {
  assert.equal(mergeWallets([], legacyWallets({ ethereum: prov() })).length, 1);
  assert.equal(mergeWallets([{ id: 'io.rabby', name: 'Rabby', provider: prov() }], legacyWallets({ ethereum: prov() })).length, 1);
});

test('the last used wallet is listed first and matched across id styles', () => {
  const a: DetectedWallet[] = [{ id: 'io.metamask', name: 'MetaMask', provider: prov() }, { id: 'io.rabby', name: 'Rabby', provider: prov() }];
  assert.equal(mergeWallets(a, [], 'legacy.rabby')[0].name, 'Rabby');
  assert.equal(mergeWallets(a, [], 'io.rabby')[0].name, 'Rabby');
  assert.ok(sameWallet('legacy.rabby', a[1]));
  assert.ok(!sameWallet('legacy.rabby', a[0]));
  assert.ok(!sameWallet(null, a[0]));
});
