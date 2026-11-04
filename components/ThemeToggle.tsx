'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? resolvedTheme ?? theme : 'dark';
  const next = current === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={current === 'dark' ? 'Light mode' : 'Dark mode'}
      onClick={() => setTheme(next)}
    >
      <span className="theme-toggle-track" data-mode={current}>
        <span className="theme-toggle-thumb" />
        <span className="theme-toggle-icon theme-toggle-sun" aria-hidden>
          ✦
        </span>
        <span className="theme-toggle-icon theme-toggle-moon" aria-hidden>
          ◐
        </span>
      </span>
    </button>
  );
}
