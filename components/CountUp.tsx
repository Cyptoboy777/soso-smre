'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * useCountUp — animates a number from 0 to `target` on mount
 * @param target  final value
 * @param duration animation ms (default 1400)
 */
export function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf.current = requestAnimationFrame(step);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return value;
}

/**
 * CountUp — drop-in span that animates to a number
 */
interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function CountUp({ value, prefix = '', suffix = '', decimals = 2, duration = 1400, style, className }: CountUpProps) {
  const animated = useCountUp(value, duration);
  return (
    <span style={style} className={className}>
      {prefix}{animated.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}
