'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

type Props = {
  active?: boolean;
  size?: number;
};

/** Smooth CSS 3D orb - lazy-safe, respects reduced motion. */
export function AiOrb({ active = false, size = 56 }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`ai-orb ${active ? 'is-active' : ''} ${reduce || offscreen ? 'is-static' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="ai-orb-core" />
      <div className="ai-orb-ring" />
      <div className="ai-orb-glow" />
    </div>
  );
}
