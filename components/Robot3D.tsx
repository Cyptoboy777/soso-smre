'use client';
import React, { useEffect, useRef } from 'react';
import type { Expression } from './AnimalFace';

/**
 * A 3D robot head built from CSS transforms (no WebGL, no extra package). It idles with a slow turn, looks toward the
 * pointer, nods and moves its mouth bars while the assistant talks, and stays still under prefers-reduced-motion.
 * All sizes are in container units (cqw) so the same markup works at 31px and 160px.
 */

// One shared pointer listener for every robot on the page (avatars in a chat would otherwise add dozens).
type Sub = (x: number, y: number) => void;
const subs = new Set<Sub>();
let ptr: { x: number; y: number } | null = null, raf = 0, bound = false;
function bind() {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  window.addEventListener('pointermove', (e) => {
    ptr = { x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (ptr) subs.forEach((f) => f(ptr!.x, ptr!.y)); });
  }, { passive: true });
}

export default function Robot3D({ size, talking = false, compact = false, still = false, stage = false, expression }: { size?: number; talking?: boolean; compact?: boolean; still?: boolean; stage?: boolean; expression?: Expression }) {
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const expr: Expression = expression ?? (talking ? 'talk' : 'happy');

  useEffect(() => {
    if (still || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    bind();
    const f: Sub = (x, y) => {
      const el = root.current, sc = scene.current;
      if (!el || !sc) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const dx = (x - (r.left + r.width / 2)) / (window.innerWidth / 2);
      const dy = (y - (r.top + r.height / 2)) / (window.innerHeight / 2);
      const c = (v: number) => Math.max(-1, Math.min(1, v));
      sc.style.setProperty('--ry', `${(c(dx) * 32).toFixed(1)}deg`);
      sc.style.setProperty('--rx', `${(-c(dy) * 20).toFixed(1)}deg`);
      sc.classList.add('is-track');
    };
    subs.add(f);
    return () => { subs.delete(f); };
  }, [still]);

  return (
    <div ref={root} className={`rb3 ${compact ? 'rb3--compact' : ''} ${still ? 'rb3--still' : ''} ${talking ? 'rb3--talk' : ''} ${stage ? 'rb3--stage' : ''} rb3--${expr}`} style={size ? { width: size } : undefined} role="img" aria-label="SoSwapDEX AI robot">
      <div className="rb3-persp">
        {stage && <div className="rb3-floor" aria-hidden><i /><i /><i /></div>}
        <div ref={scene} className="rb3-scene">
          <div className="rb3-ring" aria-hidden><b /></div>
          <div className="rb3-head">
            <div className="rb3-face rb3-front">
              <div className="rb3-visor">
                <div className="rb3-eyes"><i className="rb3-eye" /><i className="rb3-eye" /></div>
                <div className="rb3-mouth" aria-hidden><i /><i /><i /><i /><i /></div>
              </div>
            </div>
            <div className="rb3-face rb3-back" />
            <div className="rb3-face rb3-left" />
            <div className="rb3-face rb3-right" />
            <div className="rb3-face rb3-top" />
            <div className="rb3-face rb3-bottom" />
            <div className="rb3-ear rb3-ear--l"><i /></div>
            <div className="rb3-ear rb3-ear--r"><i /></div>
            <div className="rb3-ant" aria-hidden><span /><span className="rb3-ant2" /><em /><em className="rb3-ant2" /></div>
          </div>
          <div className="rb3-neck" aria-hidden />
        </div>
      </div>
    </div>
  );
}
