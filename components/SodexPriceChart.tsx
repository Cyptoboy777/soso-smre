'use client';

import { useEffect, useRef } from 'react';
import type { SodexKline } from '@/types/flow';

const INTERVALS = ['15m', '1h', '4h', '1d'] as const;

export function SodexPriceChart({
  klines,
  height = 220,
  interval = '1h',
  onInterval,
}: {
  klines: SodexKline[];
  height?: number;
  interval?: string;
  onInterval?: (iv: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !klines.length) return;
    let disposed = false;
    let chart: { remove: () => void } | null = null;

    void (async () => {
      const lc = await import('lightweight-charts');
      if (disposed || !ref.current) return;
      const isLight = document.documentElement.classList.contains('light');
      chart = lc.createChart(ref.current, {
        height,
        layout: {
          background: { color: 'transparent' },
          textColor: isLight ? '#5c4a44' : '#a8a29e',
        },
        grid: {
          vertLines: { color: isLight ? 'rgba(127,39,17,0.08)' : 'rgba(255,247,237,0.06)' },
          horzLines: { color: isLight ? 'rgba(127,39,17,0.08)' : 'rgba(255,247,237,0.06)' },
        },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true },
        crosshair: { mode: 1 },
      }) as unknown as { remove: () => void; addSeries?: Function; addCandlestickSeries?: Function };

      const series =
        // v5 API
        typeof (chart as any).addSeries === 'function'
          ? (chart as any).addSeries(lc.CandlestickSeries, {
              upColor: '#1ea858',
              downColor: '#f24237',
              borderUpColor: '#1ea858',
              borderDownColor: '#f24237',
              wickUpColor: '#1ea858',
              wickDownColor: '#f24237',
            })
          : (chart as any).addCandlestickSeries({
              upColor: '#1ea858',
              downColor: '#f24237',
              borderUpColor: '#1ea858',
              borderDownColor: '#f24237',
              wickUpColor: '#1ea858',
              wickDownColor: '#f24237',
            });

      const data = [...klines]
        .filter((k) => k.t && k.o && k.h && k.l && k.c)
        .sort((a, b) => a.t - b.t)
        .map((k) => ({
          time: Math.floor(k.t / 1000) as unknown as string,
          open: k.o,
          high: k.h,
          low: k.l,
          close: k.c,
        }));
      series.setData(data);
      (chart as any).timeScale?.().fitContent?.();

      const ro = new ResizeObserver(() => {
        if (!ref.current) return;
        (chart as any).applyOptions?.({ width: ref.current.clientWidth });
      });
      ro.observe(ref.current);
      (chart as any).__ro = ro;
    })();

    return () => {
      disposed = true;
      try {
        const c = chart as any;
        c?.__ro?.disconnect?.();
        c?.remove?.();
      } catch {
        /* ignore */
      }
    };
  }, [klines, height]);

  return (
    <div className="sodex-chart-wrap">
      {onInterval ? (
        <div className="sodex-tf-row" role="tablist" aria-label="Chart timeframe">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              role="tab"
              aria-selected={interval === iv}
              className={`sodex-tf ${interval === iv ? 'is-active' : ''}`}
              onClick={() => onInterval(iv)}
            >
              {iv}
            </button>
          ))}
        </div>
      ) : null}
      {!klines.length ? (
        <div className="skeleton" style={{ height }} aria-hidden />
      ) : (
        <div ref={ref} style={{ width: '100%', height }} aria-label="Live candlestick chart" />
      )}
    </div>
  );
}
