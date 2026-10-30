'use client';

import { useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Lenis smooth scroll — disabled when prefers-reduced-motion. */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || typeof window === 'undefined') return;
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let raf = 0;
    let cancelled = false;
    void import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      const instance = new Lenis({
        duration: 1.05,
        smoothWheel: true,
        touchMultiplier: 1.1,
      });
      lenis = instance;
      const loop = (t: number) => {
        instance.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, [reduce]);

  return <>{children}</>;
}
