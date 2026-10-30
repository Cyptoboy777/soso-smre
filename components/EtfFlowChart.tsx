'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { EtfFlowDay } from '@/types/flow';

function tipMoney(n: number) {
  const sign = n < 0 ? '−' : '+';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

export function EtfFlowChart({ history, height = 140 }: { history: EtfFlowDay[]; height?: number }) {
  const data = [...history].reverse().map((h) => ({
    date: h.date.slice(5),
    full: h.date,
    flow: h.totalNetInflow,
    abs: Math.abs(h.totalNetInflow),
  }));

  if (!data.length) {
    return (
      <div className="empty-state">
        <strong>No history yet</strong>
        <span>ETF daily net flows will chart here.</span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, marginTop: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="flowArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF7637" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#FF7637" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#A3A3A3', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#525252', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
          <Tooltip
            cursor={{ fill: 'rgba(255,79,32,0.06)' }}
            contentStyle={{
              background: '#121212',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              fontSize: 12,
              color: '#F5F5F5',
            }}
            formatter={(value: number) => [tipMoney(value), 'Net flow']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ''}
          />
          <Area type="monotone" dataKey="flow" stroke="none" fill="url(#flowArea)" />
          <Bar dataKey="flow" radius={[4, 4, 0, 0]} maxBarSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.flow >= 0 ? '#1EA858' : '#F24237'} fillOpacity={0.85} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
