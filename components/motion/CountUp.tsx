"use client";

import { useEffect, useRef } from "react";

/**
 * A formatted number ("$1,234.56", "≈ 0.0123", "0.12%") that counts from its previous
 * value to the new one. Only the first number in the string moves; prefix and suffix stay put.
 * Text is written straight to the DOM in a rAF loop (no React re-render per frame).
 * A hidden copy of the final text reserves the width, so the row does not jump.
 */
const RE = /-?\d[\d,]*(?:\.\d+)?/;
type Parsed = { pre: string; post: string; n: number; dec: number; group: boolean };

function parse(s: string): Parsed | null {
  const m = RE.exec(s);
  if (!m) return null;
  const raw = m[0];
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return { pre: s.slice(0, m.index), post: s.slice(m.index + raw.length), n, dec: raw.includes(".") ? raw.split(".")[1].length : 0, group: raw.includes(",") };
}
const fmt = (n: number, p: Parsed) =>
  p.group ? n.toLocaleString("en-US", { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec }) : n.toFixed(p.dec);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function reduced() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function CountUp({ value, duration = 420, className = "" }: { value: string; duration?: number; className?: string }) {
  const live = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    const el = live.current;
    if (!el) return;
    const from = parse(shown.current);
    const to = parse(value);
    cancelAnimationFrame(raf.current);
    if (!from || !to || from.pre !== to.pre || from.post !== to.post || from.n === to.n || reduced() || document.hidden) {
      el.textContent = value; shown.current = value; return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const s = t >= 1 ? value : to.pre + fmt(from.n + (to.n - from.n) * ease(t), to) + to.post;
      el.textContent = s; shown.current = s;
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return (
    <span className={`ss-count ${className}`}>
      <span aria-hidden className="ss-count-ghost">{value}</span>
      <span ref={live} className="ss-count-live">{value}</span>
    </span>
  );
}
