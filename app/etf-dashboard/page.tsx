'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';

interface Fund {
  ticker: string;
  name: string;
  aum: number | null;
  inflow: number | null;
  valueTraded: number | null;
  pos: boolean;
}

interface EtfResponse {
  totalInflow: number | null;
  totalOutflow: number | null;
  totalAssets: number | null;
  valueTraded: number | null;
  funds: Fund[];
}

const money = (value: number | null) => {
  if (value === null) return '--';
  const abs = Math.abs(value);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

export default function ETFDashboardPage() {
  const [data, setData] = useState<EtfResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/etf');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'ETF data unavailable');
      setData(payload as EtfResponse);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ETF data unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalInflow = data?.totalInflow ?? null;
  const outflow = data?.totalOutflow ?? null;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 4 }}>ETF Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>US Spot Bitcoin ETF live flows from SoSoValue API</p>
        </div>
        <button onClick={load} disabled={loading} style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-bold)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'not-allowed' : 'pointer' }}>
          <RefreshCw size={16} color="var(--accent-orange)" className={loading ? 'spin' : ''} />
        </button>
      </div>

      {error && <div style={{ marginBottom: 18, color: '#f43f5e', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'NET FLOW', value: money(totalInflow), color: (totalInflow ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
          { label: 'OUTFLOW', value: money(outflow), color: 'var(--accent-red)' },
          { label: 'TOTAL NET ASSETS', value: money(data?.totalAssets ?? null), color: 'var(--accent-orange)' },
        ].map(c => (
          <div key={c.label} className="neon-border glass" style={{ borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c.color, fontFamily: 'monospace' }}>{loading ? '--' : c.value}</div>
          </div>
        ))}
      </div>

      <div className="neon-border glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>US Spot Bitcoin ETFs</span>
          <span style={{ fontSize: 10, color: 'var(--accent-orange)', fontWeight: 800 }}>SOSOVALUE LIVE API</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Ticker', 'Fund', 'AUM', 'Net Inflow', 'Value Traded'].map(h => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: 10, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.funds ?? []).map(e => (
                <tr key={e.ticker} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '16px 24px' }}><span style={{ fontSize: 13, fontWeight: 900, color: 'var(--accent-orange)' }}>{e.ticker}</span></td>
                  <td style={{ padding: '16px 24px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{e.name}</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{money(e.aum)}</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, fontWeight: 900, color: e.pos ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'monospace' }}>{money(e.inflow)}</td>
                  <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {e.pos ? <TrendingUp size={14} color="var(--accent-green)" /> : <TrendingDown size={14} color="var(--accent-red)" />}
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, fontFamily: 'monospace' }}>{money(e.valueTraded)}</span>
                  </td>
                </tr>
              ))}
              {!loading && !error && !data?.funds?.length && (
                <tr><td colSpan={5} style={{ padding: 40, color: 'var(--text-dim)', fontSize: 13, textAlign: 'center' }}>No ETF rows returned by provider.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
