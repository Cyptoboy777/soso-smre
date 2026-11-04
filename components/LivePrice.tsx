'use client';

import { useEffect, useRef, useState } from 'react';

export function LivePrice({ value, className = '' }: { value: number | null | undefined; className?: string }) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    if (prev.current != null && value !== prev.current) {
      setFlash(value > prev.current ? 'up' : 'down');
      const t = window.setTimeout(() => setFlash(null), 500);
      prev.current = value;
      return () => window.clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  if (value == null || !Number.isFinite(value)) return <span className={className}>-</span>;
  return (
    <span className={`live-price tabular ${flash ? `flash-${flash}` : ''} ${className}`}>
      {value.toLocaleString(undefined, { maximumFractionDigits: value >= 1000 ? 2 : 4 })}
    </span>
  );
}
