import { describe, expect, it } from 'vitest';
import {
  formatPair,
  formatPrice,
  formatSideLabel,
  formatVolume,
  sanitizePublicText,
  stripNewsTokens,
} from '@/lib/display';

describe('stripNewsTokens', () => {
  it('removes [news:ID] tokens', () => {
    const raw =
      'Pressure from [news:2117841730512568321] and [news:2117813830196924417] remains.';
    expect(stripNewsTokens(raw)).toBe('Pressure from and remains.');
    expect(sanitizePublicText(raw)).not.toMatch(/news:\d+/);
  });
});

describe('formatPair', () => {
  it('maps internal symbols', () => {
    expect(formatPair('vBTC_vUSDC')).toBe('BTC/USDC');
    expect(formatPair('vETH_vUSDC')).toBe('ETH/USDC');
    expect(formatPair('vPEPE_vUSDC')).toBe('PEPE/USDC');
  });
});

describe('formatPrice', () => {
  it('keeps tiny prices readable', () => {
    const pepe = formatPrice(0.00000507);
    expect(pepe).not.toBe('0');
    expect(pepe).toMatch(/5/);
  });
  it('formats BTC-scale', () => {
    expect(formatPrice(78401)).toMatch(/78/);
  });
});

describe('formatVolume', () => {
  it('compacts large volumes', () => {
    expect(formatVolume(428639711)).toMatch(/M|B/);
  });
});

describe('sanitizePublicText', () => {
  it('maps sides and symbols', () => {
    const out = sanitizePublicText('SHORT on vBTC_vUSDC. Stance is FLAT.');
    expect(out).toContain('Bearish on BTC/USDC');
    expect(out).toContain('Neutral');
    expect(out).not.toMatch(/\bFLAT\b/);
    expect(out).not.toMatch(/vBTC/);
    expect(sanitizePublicText('We remain flat on the desk')).toMatch(/Neutral/i);
    expect(sanitizePublicText('maintaining a flat posture')).toMatch(/Neutral posture/i);
  });
});

describe('formatSideLabel', () => {
  it('maps thesis sides', () => {
    expect(formatSideLabel('LONG')).toBe('Bullish');
    expect(formatSideLabel('SHORT')).toBe('Bearish');
    expect(formatSideLabel('FLAT')).toBe('Neutral');
  });
});
