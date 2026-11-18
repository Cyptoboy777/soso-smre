import test from 'node:test';
import assert from 'node:assert/strict';
import { aiGate, budgetExceeded, clientIp, rateLimit, rateLimitLocal, sameOrigin, tooLarge } from '../lib/rate-limit.ts';

const req = (h: Record<string, string>) => ({ headers: new Headers(h) });
const realFetch = globalThis.fetch;
const clearRedis = () => { delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; globalThis.fetch = realFetch; };

test('clientIp trusts platform headers and never the first x-forwarded-for entry', () => {
  assert.equal(clientIp(req({ 'x-vercel-forwarded-for': '7.7.7.7', 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '1.1.1.1' })), '7.7.7.7');
  assert.equal(clientIp(req({ 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '6.6.6.6' })), '8.8.8.8');
  assert.equal(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 9.9.9.9' })), '9.9.9.9');
  assert.equal(clientIp(req({})), 'unknown');
});

test('rotating a spoofed x-forwarded-for does not dodge the limit', async () => {
  clearRedis();
  const out: boolean[] = [];
  for (let i = 0; i < 5; i++) out.push(await rateLimit(req({ 'x-real-ip': '4.4.4.4', 'x-forwarded-for': `10.0.0.${i}, 4.4.4.4` }), 't-spoof', 3));
  assert.deepEqual(out, [false, false, false, true, true]);
  assert.equal(await rateLimit(req({ 'x-real-ip': '5.5.5.5' }), 't-spoof', 3), false, 'another visitor has their own window');
});

test('rateLimitLocal and budgetExceeded count correctly', async () => {
  clearRedis();
  const a: boolean[] = [];
  for (let i = 0; i < 4; i++) a.push(rateLimitLocal(req({ 'x-real-ip': '3.3.3.3' }), 't-local', 2));
  assert.deepEqual(a, [false, false, true, true]);
  const b: boolean[] = [];
  for (let i = 0; i < 4; i++) b.push(await budgetExceeded('t-budget', 2, 60_000));
  assert.deepEqual(b, [false, false, true, true]);
});

test('uses the shared Upstash counter when configured', async () => {
  const store = new Map<string, number>(); const urls: string[] = [];
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io/'; process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  globalThis.fetch = (async (url: string, init: { body: string; headers: Record<string, string> }) => {
    urls.push(url);
    assert.equal(init.headers.authorization, 'Bearer tok');
    const cmds = JSON.parse(init.body); const k = cmds[0][1]; store.set(k, (store.get(k) ?? 0) + 1);
    return new Response(JSON.stringify([{ result: store.get(k) }, { result: 1 }]), { status: 200 });
  }) as unknown as typeof fetch;
  try {
    const out: boolean[] = [];
    for (let i = 0; i < 3; i++) out.push(await rateLimit(req({ 'x-real-ip': '2.2.2.2' }), 't-durable', 2));
    assert.deepEqual(out, [false, false, true]);
    assert.equal(urls[0], 'https://fake.upstash.io/pipeline');
    assert.ok([...store.keys()][0].startsWith('rl:t-durable:2.2.2.2'));
  } finally { clearRedis(); }
});

test('falls back to the in-memory counter when Upstash is down', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io'; process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  globalThis.fetch = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
  try {
    const out: boolean[] = [];
    for (let i = 0; i < 3; i++) out.push(await rateLimit(req({ 'x-real-ip': '1.2.3.4' }), 't-fallback', 2));
    assert.deepEqual(out, [false, false, true]);
  } finally { clearRedis(); }
});

test('sameOrigin refuses other websites, allows own site and header-less clients', () => {
  assert.equal(sameOrigin(req({ host: 'soswapdex.xyz', origin: 'https://soswapdex.xyz', 'sec-fetch-site': 'same-origin' })), true);
  assert.equal(sameOrigin(req({ host: 'soswapdex.xyz', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(sameOrigin(req({ host: 'soswapdex.xyz', origin: 'https://evil.example' })), false);
  assert.equal(sameOrigin(req({ host: 'soswapdex.xyz', origin: 'not a url' })), false);
  assert.equal(sameOrigin(req({ host: 'soswapdex.xyz' })), true);
  // no Sec-Fetch-Site (older browsers): compare Origin with the addressed host(s), including a proxy chain
  assert.equal(sameOrigin(req({ host: 'internal.vercel', 'x-forwarded-host': 'soswapdex.xyz, cdn.example', origin: 'https://soswapdex.xyz' })), true);
  assert.equal(sameOrigin(req({ host: 'SoSwapDEX.xyz', origin: 'https://soswapdex.xyz' })), true);
  // a same-origin browser request is trusted even if the platform rewrote the host
  assert.equal(sameOrigin(req({ host: 'rewritten.internal', origin: 'https://soswapdex.xyz', 'sec-fetch-site': 'same-origin' })), true);
  assert.equal(sameOrigin(req({ host: 'soswapdex.xyz', 'sec-fetch-site': 'same-site' })), false);
});

test('tooLarge compares content-length', () => {
  assert.equal(tooLarge(req({ 'content-length': '5000' }), 4096), true);
  assert.equal(tooLarge(req({ 'content-length': '100' }), 4096), false);
  assert.equal(tooLarge(req({}), 4096), false);
});

test('aiGate applies origin, per-minute, per-day and the shared daily budget in order', async () => {
  clearRedis();
  const own = { host: 'soswapdex.xyz', origin: 'https://soswapdex.xyz', 'sec-fetch-site': 'same-origin' };
  assert.equal((await aiGate(req({ ...own, 'x-real-ip': '9.0.0.1', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }), 'g1', { perMinute: 2, perDay: 10 }))?.status, 403);
  const codes: (number | null)[] = [];
  for (let i = 0; i < 4; i++) codes.push((await aiGate(req({ ...own, 'x-real-ip': '9.0.0.2' }), 'g2', { perMinute: 2, perDay: 10 }))?.status ?? null);
  assert.deepEqual(codes, [null, null, 429, 429]);
  const day: (number | null)[] = [];
  for (let i = 0; i < 3; i++) day.push((await aiGate(req({ ...own, 'x-real-ip': '9.0.0.3' }), 'g3', { perMinute: 99, perDay: 2 }))?.status ?? null);
  assert.deepEqual(day, [null, null, 429]);
  // shared budget across different visitors and routes
  process.env.AI_DAILY_CAP = '2';
  try {
    // earlier calls in this test already used more than 2 hits of the shared budget
    const blocked = await aiGate(req({ ...own, 'x-real-ip': '9.0.0.4' }), 'g4', { perMinute: 99, perDay: 99 });
    assert.equal(blocked?.status, 429);
    assert.match(blocked?.error ?? '', /paused for today/);
  } finally { delete process.env.AI_DAILY_CAP; }
});
