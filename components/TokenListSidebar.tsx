'use client';

import { useMemo, useState, useEffect, memo } from 'react';
import type { Ticker } from '@/types/sodex';
import { fmtPrice, fmtVol } from '@/lib/sodex';
import { TrendingUp, TrendingDown, Activity, BarChart2 } from 'lucide-react';
import { useSodexStore } from '@/store/sodexStore';

interface Props {
  onSelectTicker: (ticker: Ticker) => void;
}

const TokenListSidebar = memo(function TokenListSidebar({ onSelectTicker }: Props) {
  const tickerList = useSodexStore(state => state.tickerList);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'vol'|'gainers'|'losers'|'etf'>('vol');
  const [etfData, setEtfData] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'etf' && !etfData) {
      fetch('/api/etf').then(r => r.json()).then(setEtfData).catch(console.error);
    }
  }, [activeTab, etfData]);
  
  const { gainers, losers, volLeaders } = useMemo(() => {
    let list = [...tickerList].filter(t => t.lastPrice > 0);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t => t.base.toLowerCase().includes(s) || t.symbol.toLowerCase().includes(s));
    }
    return {
      gainers: [...list].sort((a, b) => b.priceChangePct - a.priceChangePct).slice(0, 15),
      losers: [...list].sort((a, b) => a.priceChangePct - b.priceChangePct).slice(0, 15),
      volLeaders: [...list].sort((a, b) => b.quoteVolume - a.quoteVolume).slice(0, 15),
    };
  }, [tickerList, search]);

  const renderList = (title: string, icon: React.ReactNode, items: Ticker[], color: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      {items.map(t => (
        <button 
          key={t.symbol} 
          onClick={() => onSelectTicker(t)}
          style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            background: 'transparent', border: 'none', padding: '6px 8px', cursor: 'pointer', borderRadius: 6,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: `linear-gradient(135deg, ${color}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 900, color: '#fff' }}>
              {t.base.slice(0, 2)}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e0e0f0' }}>{t.base}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>${fmtPrice(t.lastPrice)}</span>
            <span style={{ fontSize: 9, fontWeight: 800, color }}>
              {t.priceChangePct >= 0 ? '+' : ''}{t.priceChangePct.toFixed(2)}%
            </span>
          </div>
        </button>
      ))}
    </div>
  );

  const renderEtfList = () => {
    if (!etfData) return <div style={{ padding: 12, color: '#888', fontSize: 10, textAlign: 'center' }}>Loading SoSoValue ETF Data...</div>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', marginBottom: 4 }}>
          <Activity size={12} color="#f97316" />
          <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>BTC SPOT ETF FLOWS</span>
        </div>
        <div style={{ padding: '8px', marginBottom: 8, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 6, fontSize: 11, color: '#f97316', textAlign: 'center', fontWeight: 800 }}>
          Net Daily Flow: {etfData.totalInflow > 0 ? '+' : ''}${etfData.totalInflow?.toLocaleString() ?? 0}M
        </div>
        {etfData.funds.map((f: any) => (
          <div key={f.ticker} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, color: '#e0e0f0', fontWeight: 800 }}>{f.ticker}</span>
              <span style={{ fontSize: 8, color: '#8888aa' }}>{f.name}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 10, color: f.pos ? '#00e676' : '#f43f5e', fontWeight: 900, fontFamily: 'monospace' }}>
                {f.pos && f.inflow ? '+' : ''}{f.inflow !== null ? `$${f.inflow}M` : '--'}
              </span>
              <span style={{ fontSize: 8, color: '#666688' }}>INFLOW</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #1a1a2e', background: '#09090f', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ padding: '16px 12px', borderBottom: '1px solid #1e1e3a', background: '#0d0d1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#111120', border: '1px solid #1e1e3a', borderRadius: 8, padding: '6px 10px', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#8888aa', marginRight: 8 }}>🔍</span>
          <input 
            type="text" placeholder="Search tokens..." 
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, width: '100%', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', background: '#141425', borderRadius: 8, padding: 4 }}>
          {(['vol', 'gainers', 'losers', 'etf'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '6px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                background: activeTab === tab ? (tab === 'etf' ? '#f97316' : '#a78bfa') : 'transparent', 
                color: activeTab === tab ? '#000' : '#8888aa', textTransform: 'uppercase'
              }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} className="scroll-track">
        {activeTab === 'vol' && renderList('VOLUME LEADERS', <BarChart2 size={12} color="#38bdf8" />, volLeaders, '#38bdf8')}
        {activeTab === 'gainers' && renderList('TOP GAINERS', <TrendingUp size={12} color="#00e676" />, gainers, '#00e676')}
        {activeTab === 'losers' && renderList('TOP LOSERS', <TrendingDown size={12} color="#f43f5e" />, losers, '#f43f5e')}
        {activeTab === 'etf' && renderEtfList()}
      </div>
    </div>
  );
});

export default TokenListSidebar;
