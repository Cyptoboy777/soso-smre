import { describe, expect, it } from 'vitest';
import { formatStatNumber } from '@/lib/sodex-builder-fee-stats';
import { buildShareUrl, normalizeRef } from '@/lib/referral';
import { publicErrorMessage } from '@/lib/public-errors';
import { isLocale, LOCALES, MESSAGES } from '@/lib/i18n';

describe('builder race v2 helpers', () => {
  it('formats stats without inventing NaN', () => {
    expect(formatStatNumber('12.5')).toBe('12.5');
    expect(formatStatNumber('not-a-number')).toBe('not-a-number');
  });

  it('validates referral codes', () => {
    expect(normalizeRef('flowsentinel')).toBe('flowsentinel');
    expect(normalizeRef('../evil')).toBeNull();
    expect(
      buildShareUrl({
        origin: 'https://example.com',
        path: '/',
        ideaId: 'btc-long',
        ref: 'flowsentinel',
      }),
    ).toContain('ref=flowsentinel');
  });

  it('never leaks env names in public errors', () => {
    expect(publicErrorMessage('SODEX_MAINNET_TRADING kill switch is off')).not.toMatch(
      /SODEX_|kill switch/i,
    );
    expect(publicErrorMessage('Explicit user confirmation required')).toMatch(/confirm/i);
  });

  it('ships only EN/ES/PT/ZH/FR locales', () => {
    expect(LOCALES).toEqual(['en', 'es', 'pt', 'zh', 'fr']);
    expect(isLocale('hi')).toBe(false);
    expect(MESSAGES.en.statsTitle).toBeTruthy();
    for (const loc of LOCALES) {
      expect(MESSAGES[loc].navDesk.length).toBeGreaterThan(0);
    }
  });
});
