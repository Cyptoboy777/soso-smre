"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";

export default function SoDexMarketsPage() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTokens = async () => {
    try {
      const response = await fetch("/api/tokens");
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      // SoDEX API usually returns { data: [...] } or direct array
      const rawTokens = data.data || data || [];
      setTokens(Array.isArray(rawTokens) ? rawTokens : []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load SoDEX market data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 15000);
    return () => clearInterval(interval);
  }, []);

  const fmt = (val: string | number) => {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(n)) return '0.00';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const getChangeColor = (change: string | number) => {
    const n = typeof change === 'string' ? parseFloat(change) : change;
    if (isNaN(n)) return 'var(--text-secondary)';
    return n >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  };

  return (
    <main className="fade-up" style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <BarChart3 size={24} color="var(--accent-orange)" />
            <h1 style={{ fontSize: 32, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.04em' }}>SoDEX Global Markets</h1>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Real-time listed spot market tickers from SoDEX liquidity layers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="glass" style={{ padding: '8px 16px', borderRadius: 12, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} color="var(--accent-green)" />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: 'var(--accent-green)' }}>NETWORK: MAINNET</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="neon-border" style={{ padding: 20, borderRadius: 16, background: 'rgba(244,63,94,0.05)', color: 'var(--accent-red)', marginBottom: 32, border: '1px solid rgba(244,63,94,0.2)' }}>
          {error}
        </div>
      )}

      {loading && tokens.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="shimmer" style={{ height: 160, borderRadius: 20 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {tokens.map((token, index) => {
            const price = token.price || token.lastPrice || '0';
            const volume = token.volume || token.volume24h || '0';
            const change = token.change || token.priceChangePercent || '0';
            const symbol = token.symbol || token.market || 'UNKNOWN';

            return (
              <div key={index} className="neon-border glass" style={{ padding: 24, borderRadius: 20, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.15em', marginBottom: 4 }}>SYMBOL</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>{symbol}</div>
                  </div>
                  <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.03)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={16} color="var(--accent-orange)" />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.15em', marginBottom: 4 }}>LAST PRICE</div>
                  <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', color: 'var(--text-primary)' }}>${fmt(price)}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.1em', marginBottom: 4 }}>24H VOLUME</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmt(volume)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.1em', marginBottom: 4 }}>24H CHANGE</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {parseFloat(change) >= 0 ? <TrendingUp size={12} color="var(--accent-green)" /> : <TrendingDown size={12} color="var(--accent-red)" />}
                      <span style={{ fontSize: 13, fontWeight: 800, color: getChangeColor(change), fontFamily: 'monospace' }}>
                        {parseFloat(change) >= 0 ? '+' : ''}{parseFloat(change).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tokens.length === 0 && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          No active markets found on SoDEX Mainnet Gateway.
        </div>
      )}
    </main>
  );
}
