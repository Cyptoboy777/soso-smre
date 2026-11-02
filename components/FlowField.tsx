'use client';

import { useEffect, useRef } from 'react';

/** Subtle brand-orange particle / flow-line field behind the hero. */
export function FlowField({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let w = 0;
    let h = 0;
    const particles = Array.from({ length: 48 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      v: 0.00025 + (i % 7) * 0.00008,
      len: 0.02 + (i % 5) * 0.008,
      a: 0.08 + (i % 4) * 0.04,
    }));

    const resize = () => {
      const parent = canvas.parentElement;
      w = parent?.clientWidth ?? 800;
      h = parent?.clientHeight ?? 420;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (!reduce) {
          p.x += p.v;
          if (p.x > 1.1) p.x = -0.1;
        }
        const x0 = p.x * w;
        const y0 = p.y * h;
        const x1 = x0 + p.len * w;
        const g = ctx.createLinearGradient(x0, y0, x1, y0);
        g.addColorStop(0, `rgba(255,79,32,0)`);
        g.addColorStop(0.5, `rgba(255,118,55,${p.a})`);
        g.addColorStop(1, `rgba(255,79,32,0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y0 + Math.sin(p.x * 12) * 6);
        ctx.stroke();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    if (reduce) {
      // static frame only
    }

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduce) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
