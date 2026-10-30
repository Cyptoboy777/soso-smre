'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const DeskClient = dynamic(() => import('./DeskClient').then((m) => m.DeskClient), {
  ssr: false,
  loading: () => (
    <section className="panel" style={{ marginTop: 24, padding: 28, minHeight: 280 }} aria-busy>
      <p className="muted" style={{ margin: 0 }}>
        Loading live desk…
      </p>
    </section>
  ),
});

/** Mount the heavy desk only after idle + near viewport to protect mobile TBT. */
export function DeskBelowFold() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const el = ref.current;

    const arm = () => {
      const go = () => {
        if (!cancelled) setReady(true);
      };
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(go, { timeout: 4500 });
      } else {
        timer = setTimeout(go, 2800);
      }
    };

    if (!el || typeof IntersectionObserver === 'undefined') {
      arm();
    } else {
      const io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            io.disconnect();
            arm();
          }
        },
        { rootMargin: '240px' },
      );
      io.observe(el);
      // Fallback if user never scrolls (Lighthouse mobile still needs desk eventually)
      timer = setTimeout(() => {
        io.disconnect();
        arm();
      }, 6000);
      return () => {
        cancelled = true;
        io.disconnect();
        if (idleId != null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
        if (timer) clearTimeout(timer);
      };
    }

    return () => {
      cancelled = true;
      if (idleId != null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <div ref={ref}>{ready ? <DeskClient /> : null}</div>;
}
