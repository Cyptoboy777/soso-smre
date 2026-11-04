'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  LOCALES,
  MESSAGES,
  isLocale,
  type Locale,
} from '@/lib/i18n';
import { persistRefFromUrl } from '@/lib/referral';

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (typeof MESSAGES)['en'];
};

const LocaleCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = 'fs_locale';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch {
      /* ignore */
    }
    persistRefFromUrl(window.location.search);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l === 'zh' ? 'zh-Hans' : l;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t: MESSAGES[locale] }),
    [locale, setLocale],
  );

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) {
    return {
      locale: 'en' as Locale,
      setLocale: (_: Locale) => undefined,
      t: MESSAGES.en,
    };
  }
  return ctx;
}

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--text-muted)',
      }}
    >
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={locale}
        onChange={(e) => {
          const v = e.target.value;
          if (isLocale(v)) setLocale(v);
        }}
        style={{
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '6px 8px',
          fontSize: 12,
          minHeight: 36,
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {l.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
