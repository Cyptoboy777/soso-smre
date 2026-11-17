import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRelayQuote } from '../lib/routes/relay.ts';
import { normalizeLifiQuote } from '../lib/routes/lifi.ts';
import { getNormalizedQuote, readFeeEnv } from '../lib/routes/quote.ts';
import { allowRequest, resetRateLimit } from '../lib/routes/rateLimit.ts';
import { validateQuoteBody, validateRequestId, validateTxHash } from '../lib/routes/validate.ts';
import { nextPollMs, statusLabel } from '../lib/routes/execute.ts';
import type { QuoteInput } from '../lib/routes/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const relayFix = JSON.parse(readFileSync(join(root, 'tests/fixtures/relay-quote.json'), 'utf8'));
const lifiFix = JSON.parse(readFileSync(join(root, 'tests/fixtures/lifi-quote.json'), 'utf8'));

const input: QuoteInput = {
  user: '0x1111111111111111111111111111111111111111',
  recipient: '0x1111111111111111111111111111111111111111',
  originChainId: 1,
  destinationChainId: 8453,
  originCurrency: '0x0000000000000000000000000000000000000000',
  destinationCurrency: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: '10000000000000000',
  originToken: 'ETH',
  destinationToken: 'USDC',
  destinationSodexChain: 'BASE',
};

test('recipient other than the user is rejected', () => {
  const r = validateQuoteBody({ ...input, recipient: '0x2222222222222222222222222222222222222222' });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 400);
    assert.equal(r.error, 'Recipient must be your own wallet.');
  }
});

test('unsupported destination is rejected before quoting', () => {
  const r = validateQuoteBody({ ...input, destinationSodexChain: 'DOGE', destinationToken: 'USDC' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /SoDEX will not credit this/);
});


test('send-onward quotes can leave the SoDEX allowlist but still require the same wallet', () => {
  const onward = validateQuoteBody({ ...input, purpose: 'onward', destinationSodexChain: '', destinationToken: 'USDC', destinationChainId: 8453 });
  assert.equal(onward.ok, true);
  const bad = validateQuoteBody({ ...input, purpose: 'onward', recipient: '0x2222222222222222222222222222222222222222' });
  assert.equal(bad.ok, false);
});

test('malformed addresses, chain ids and amounts are rejected', () => {
  assert.equal(validateQuoteBody({ ...input, user: 'not-an-address' }).ok, false);
  assert.equal(validateQuoteBody({ ...input, amount: '12.5' }).ok, false);
  assert.equal(validateQuoteBody({ ...input, amount: '0' }).ok, false);
  assert.equal(validateQuoteBody({ ...input, originChainId: 999 }).ok, false);
});

test('request id and tx hash are strictly whitelisted', () => {
  assert.equal(validateRequestId('req_sim_001'), true);
  assert.equal(validateRequestId('abc'), false);
  assert.equal(validateRequestId('bad id!'), false);
  assert.equal(validateTxHash('0x' + 'ab'.repeat(16)), true);
  assert.equal(validateTxHash('nope'), false);
});

test('Relay fixture (simulated) normalizes to the shared quote shape', () => {
  const q = normalizeRelayQuote(relayFix, input, 0);
  assert.ok(q);
  assert.equal(q!.provider, 'relay');
  assert.equal(q!.requestId, 'req_sim_001');
  assert.equal(q!.outAmount, '9.9');
  assert.equal(q!.minOut, '9.8');
  assert.equal(q!.feeUsd, 0.42);
  assert.equal(q!.etaSec, 60);
  assert.equal(q!.steps.length, 1);
  assert.equal(q!.steps[0].kind, 'transaction');
  assert.equal(q!.steps[0].tx?.to, '0x2222222222222222222222222222222222222222');
});

test('LI.FI fixture (simulated) normalizes to the shared quote shape', () => {
  const q = normalizeLifiQuote(lifiFix, input, 0);
  assert.ok(q);
  assert.equal(q!.provider, 'lifi');
  assert.equal(q!.outAmount, '9.91');
  assert.equal(q!.minOut, '9.81');
  assert.equal(q!.feeUsd, 0.35);
  assert.equal(q!.etaSec, 90);
  assert.equal(q!.steps[0].kind, 'transaction');
});

test('missing Relay key falls back to LI.FI (no 503)', async () => {
  const fetchFn = async (url: string | URL) => {
    const u = String(url);
    if (u.includes('relay.link')) return new Response('no key should not be called', { status: 500 });
    if (u.includes('li.quest')) return new Response(JSON.stringify(lifiFix), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('unexpected', { status: 500 });
  };
  const q = await getNormalizedQuote(input, { fetch: fetchFn as typeof fetch, relayApiKey: undefined });
  assert.ok(!('error' in q), 'should not error when LI.FI can quote');
  if (!('error' in q)) assert.equal(q.provider, 'lifi');
});

test('Relay failure falls back to LI.FI, then a friendly message if both fail', async () => {
  const relayThenLifi: typeof fetch = (async (url: string | URL) => {
    const u = String(url);
    if (u.includes('relay.link')) return new Response(JSON.stringify({ message: 'INTERNAL_PROVIDER_TEXT_MUST_NOT_LEAK' }), { status: 500 });
    if (u.includes('li.quest')) return new Response(JSON.stringify(lifiFix), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('unexpected', { status: 500 });
  }) as typeof fetch;
  const ok = await getNormalizedQuote(input, { fetch: relayThenLifi, relayApiKey: 'test-key' });
  assert.ok(!('error' in ok));
  if (!('error' in ok)) assert.equal(ok.provider, 'lifi');

  const bothFail: typeof fetch = (async () => new Response(JSON.stringify({ error: 'INTERNAL_PROVIDER_TEXT_MUST_NOT_LEAK' }), { status: 500 })) as typeof fetch;
  const fail = await getNormalizedQuote(input, { fetch: bothFail, relayApiKey: 'test-key' });
  assert.ok('error' in fail);
  if ('error' in fail) {
    assert.equal(fail.error, 'No route found right now. Try another amount or token.');
    assert.doesNotMatch(fail.error, /INTERNAL_PROVIDER/);
  }
});

test('integrator fee stays off unless bps and recipient are both set', () => {
  assert.deepEqual(readFeeEnv({}), { bps: 0 });
  assert.deepEqual(readFeeEnv({ NEXT_PUBLIC_ROUTE_FEE_BPS: '0' }), { bps: 0 });
  assert.deepEqual(readFeeEnv({ NEXT_PUBLIC_ROUTE_FEE_BPS: '50' }), { bps: 0 });
  assert.deepEqual(
    readFeeEnv({ NEXT_PUBLIC_ROUTE_FEE_BPS: '50', ROUTE_FEE_RECIPIENT: '0x1111111111111111111111111111111111111111' }),
    { bps: 50, recipient: '0x1111111111111111111111111111111111111111' },
  );
});

test('quote route rate limit is 20 per minute per IP', () => {
  resetRateLimit();
  for (let i = 0; i < 20; i++) assert.equal(allowRequest('1.2.3.4', 1_000), true);
  assert.equal(allowRequest('1.2.3.4', 1_000), false);
  assert.equal(allowRequest('9.9.9.9', 1_000), true);
  assert.equal(allowRequest('1.2.3.4', 1_000 + 60_000), true);
});

test('status poll backoff and labels stay user-facing', () => {
  assert.equal(nextPollMs(1), 2500);
  assert.equal(nextPollMs(9), 10_000);
  assert.match(statusLabel('refund'), /Refunded to your wallet/);
  assert.match(statusLabel('success'), /arrived in your wallet/);
});
