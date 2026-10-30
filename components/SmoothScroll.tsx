'use client';

import { useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || typeof window === 'undefined') return;
    // Skip on low-end / save-data to protect Lighthouse + mobile FPS
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; hardwareConcurrency?: number };
    if (nav.connection?.saveData) return;
    if ((nav.hardwareConcurrency ?? 8) <= 4) return;
    if (window.innerWidth < 700) return;

    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let raf = 0;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void import('lenis').then(({ default: Lenis }) => {
        if (cancelled) return;
        const instance = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.1 });
        lenis = instance;
        const loop = (t: number) => {
          instance.raf(t);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      });
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, [reduce]);

  return <>{children}</>;
}
