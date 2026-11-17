import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSetup, type SetupIn } from './setup.ts';

const mk = (closes: number[]) => closes.map((c, i) => ({ t: i * 3600e3, o: c, h: c * 1.004, l: c * 0.996, c, v: 1 }));
const base: Omit<SetupIn, 'candles' | 'bids' | 'asks'> = { pair: 'X', display: 'X/USDC', base: 'vX', last: 100, quoteVol: 1e6, takerFee: 0.0005, halted: false, equity: 1000, riskPct: 1 };
const book = (p: number, size = 1e6) => ({ bids: [{ price: p * 0.9995, size }], asks: [{ price: p * 1.0005, size }] });
const wave = [...Array(80)].map((_, i) => 100 + Math.sin(i / 5) * 1 + i * 0.05);
const lcg = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('real R:R never falls below 1:2 on a tradable setup (random markets)', () => {
  let tradable = 0;
  for (let s = 1; s <= 300; s++) {
    const r = lcg(s); let p = 100; const c: number[] = [];
    for (let i = 0; i < 80; i++) { p *= 1 + (r() - 0.48) * 0.01; c.push(p); }
    const o = computeSetup({ ...base, candles: mk(c), ...book(p) });
    if (o.grade !== 'no-trade') { tradable++; assert.ok(o.rr1 >= 2 - 1e-9, `rr1 ${o.rr1} grade ${o.grade}`); }
  }
  assert.ok(tradable > 0);
});

test('a ceiling that leaves under 1:2 is a No trade, and a nearer ceiling caps the grade below A', () => {
  let blocked = 0, capped = 0;
  for (let s = 1; s <= 300; s++) {
    const r = lcg(s + 1000); let p = 100; const c: number[] = [];
    for (let i = 0; i < 80; i++) { p *= 1 + (r() - 0.48) * 0.01; c.push(p); }
    const o = computeSetup({ ...base, candles: mk(c), ...book(p) });
    if (o.grade === 'no-trade' && /ceiling/.test(o.reasons.join(' '))) blocked++;
    if (o.grade !== 'no-trade' && o.flags.some((f) => /sits before the first target/.test(f.text))) { capped++; assert.notEqual(o.grade, 'A'); assert.ok(o.tp1 > (o.resistance ?? 0)); }
  }
  assert.ok(blocked > 0, 'expected some setups blocked by a close ceiling');
  console.log('blocked by ceiling', blocked, 'tradable with a nearer ceiling', capped);
});

test('size and loss use the average fill, so a thin book cannot understate the loss', () => {
  const thin = { bids: [{ price: 99.9, size: 500 }], asks: [{ price: 100.1, size: 2 }, { price: 100.9, size: 2 }, { price: 101.5, size: 5000 }] };
  const o = computeSetup({ ...base, equity: 5000, candles: mk(wave), ...thin });
  if (o.grade !== 'no-trade') {
    const perUnit = (o.entry - o.stop) + o.entry * 2 * 0.0005;
    assert.ok(Math.abs(o.maxLoss - o.qty * perUnit) < 1e-6);
    assert.ok(o.maxLoss <= 5000 * 0.01 * 1.0001, `maxLoss ${o.maxLoss} exceeds 1% of equity`);
    assert.ok(o.entry > 100.1, 'entry should be the expected fill, above the best ask');
  }
});

test('builder fee is part of the loss and the R:R', () => {
  const a = computeSetup({ ...base, candles: mk(wave), ...book(100) });
  const b = computeSetup({ ...base, builderFeePct: 0.3, candles: mk(wave), ...book(100) });
  if (a.grade !== 'no-trade' && b.grade !== 'no-trade') { assert.ok(b.qty < a.qty); assert.ok(b.rr1 < a.rr1); }
});

test('wide spread above the limit is a No trade', () => {
  const o = computeSetup({ ...base, candles: mk(wave), bids: [{ price: 99.6, size: 1e4 }], asks: [{ price: 100.4, size: 1e4 }] });
  assert.equal(o.grade, 'no-trade');
  assert.match(o.reasons.join(' '), /spread/i);
});

test('a bounce that stays under the slow average is a downtrend', () => {
  const cl: number[] = [];
  for (let i = 0; i < 70; i++) cl.push(130 - i * 0.45);
  for (let i = 0; i < 10; i++) cl.push(98.5 + i * 0.6);
  const o = computeSetup({ ...base, candles: mk(cl), ...book(cl[cl.length - 1]) });
  if ((o.ema50 ?? 0) > cl[cl.length - 1]) { assert.equal(o.trend, 'down'); assert.equal(o.grade, 'no-trade'); }
});

test('too few candles and missing book are No trade with a reason', () => {
  const few = computeSetup({ ...base, candles: mk(wave.slice(0, 30)), ...book(100) });
  assert.equal(few.grade, 'no-trade'); assert.match(few.reasons.join(' '), /candles/i);
  const empty = computeSetup({ ...base, candles: mk(wave), bids: [], asks: [] });
  assert.equal(empty.grade, 'no-trade');
});

test('maxNotional caps the position and the loss shrinks with it', () => {
  const full = computeSetup({ ...base, candles: mk(wave), ...book(100) });
  if (full.grade !== 'no-trade') {
    const cap = full.notional / 2;
    const capped = computeSetup({ ...base, maxNotional: cap, candles: mk(wave), ...book(100) });
    assert.ok(capped.notional <= cap * 1.001); assert.ok(capped.maxLoss < full.maxLoss);
  }
});

test('missing account size or risk is a No trade, never a sized plan', () => {
  const o = computeSetup({ ...base, equity: 0, candles: mk(wave), ...book(100) });
  assert.equal(o.grade, 'no-trade'); assert.equal(o.qty, 0);
});
