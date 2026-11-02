'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { SodexKline } from '@/types/flow';

export function SodexPriceChart({
  klines,
  height = 160,
}: {
  klines: SodexKline[];
  height?: number;
}) {
  if (!klines.length) {
    return <div className="skeleton" style={{ height }} aria-hidden />;
  }
  const data = [...klines].reverse().map((k) => ({
    t: new Date(k.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    c: k.c,
  }));
  return (
    <div style={{ width: '100%', height }} aria-label="SoDEX price chart">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sodexFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF7637" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#FF4F20" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis domain={['auto', 'auto']} width={56} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#9CA3AF' }}
          />
          <Area type="monotone" dataKey="c" stroke="#FF7637" fill="url(#sodexFill)" strokeWidth={2} isAnimationActive animationDuration={700} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
