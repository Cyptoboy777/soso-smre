'use client';

import { useReducedMotion } from 'framer-motion';

type Props = {
  active?: boolean;
  size?: number;
};

/** Smooth CSS 3D orb — lazy-safe, respects reduced motion. */
export function AiOrb({ active = false, size = 56 }: Props) {
  const reduce = useReducedMotion();
  return (
    <div
      className={`ai-orb ${active ? 'is-active' : ''} ${reduce ? 'is-static' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="ai-orb-core" />
      <div className="ai-orb-ring" />
      <div className="ai-orb-glow" />
    </div>
  );
}
