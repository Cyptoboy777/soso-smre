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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>ETF Dashboard</h1>
          <p style={{ fontSize: 13, color: '#444' }}>US Spot Bitcoin ETF live flows from SoSoValue API</p>
        </div>
        <button onClick={load} disabled={loading} style={{ width: 36, height: 36, borderRadius: 8, background: '#111', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'not-allowed' : 'pointer' }}>
          <RefreshCw size={15} color="#f97316" className={loading ? 'spin' : ''} />
        </button>
      </div>

      {error && <div style={{ marginBottom: 18, color: '#f43f5e', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'NET FLOW', value: money(totalInflow), color: (totalInflow ?? 0) >= 0 ? '#00e676' : '#f43f5e' },
          { label: 'OUTFLOW', value: money(outflow), color: '#f43f5e' },
          { label: 'TOTAL NET ASSETS', value: money(data?.totalAssets ?? null), color: '#f97316' },
        ].map(c => (
          <div key={c.label} style={{ background: '#111', border: `1px solid ${c.color}20`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, fontFamily: 'monospace' }}>{loading ? '--' : c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>US Spot Bitcoin ETFs</span>
          <span style={{ fontSize: 10, color: '#f97316', fontWeight: 600 }}>SoSoValue live API</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                {['Ticker', 'Fund', 'AUM', 'Net Inflow', 'Value Traded'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.funds ?? []).map(e => (
                <tr key={e.ticker} style={{ borderBottom: '1px solid #111' }}>
                  <td style={{ padding: '14px 20px' }}><span style={{ fontSize: 13, fontWeight: 800, color: '#f97316' }}>{e.ticker}</span></td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#666' }}>{e.name}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{money(e.aum)}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: e.pos ? '#00e676' : '#f43f5e', fontFamily: 'monospace' }}>{money(e.inflow)}</td>
                  <td style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {e.pos ? <TrendingUp size={13} color="#00e676" /> : <TrendingDown size={13} color="#f43f5e" />}
                    <span style={{ fontSize: 12, color: '#aaa', fontWeight: 600 }}>{money(e.valueTraded)}</span>
                  </td>
                </tr>
              ))}
              {!loading && !error && !data?.funds?.length && (
                <tr><td colSpan={5} style={{ padding: 24, color: '#555', fontSize: 13 }}>No ETF rows returned by provider.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
