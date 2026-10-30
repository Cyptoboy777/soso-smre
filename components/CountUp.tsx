'use client';

import { useEffect, useRef, useState } from 'react';

/** Count/roll a number; jumps instantly under prefers-reduced-motion. */
export function CountUp({
  value,
  duration = 700,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!Number.isFinite(value)) {
      setDisplay(0);
      return;
    }
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  const text = `${prefix}${display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;

  return (
    <span className={`tabular ${className}`} aria-label={text}>
      {text}
    </span>
  );
}
