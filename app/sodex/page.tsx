'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export default function SoDEXPage() {
  const [tab, setTab] = useState<'spot' | 'perps'>('spot');
  
  const [spotTickers, setSpotTickers] = useState<any[]>([]);
  const [perpsTickers, setPerpsTickers] = useState<any[]>([]);
  const [markPrices, setMarkPrices] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [spotRes, perpsRes, markRes] = await Promise.all([
          fetch('/api/sodex?endpoint=spot/markets/tickers24hr').then(r => r.json()),
          fetch('/api/sodex?endpoint=perps/markets/tickers24hr').then(r => r.json()),
          fetch('/api/sodex?endpoint=perps/markets/mark-prices').then(r => r.json()),
        ]);
        
        // Extract data assuming standard API formats (array or { data: [] } or { result: [] })
        const extractArr = (d: any) => Array.isArray(d) ? d : (d?.data || d?.result || d?.tickers || []);
        
        setSpotTickers(extractArr(spotRes));
        setPerpsTickers(extractArr(perpsRes));
        setMarkPrices(extractArr(markRes));
      } catch (err) {
        console.error("Error fetching SoDEX data", err);
      }
      setLoading(false);
    };
    
    fetchData();
    const id = setInterval(fetchData, 15000);
    return () => clearInterval(id);
  }, []);

  // Helper to merge perps tickers with mark prices
  const mergedPerps = perpsTickers.map(p => {
    const symbol = p.symbol || p.s || p.instId;
    const mp = markPrices.find((m: any) => (m.symbol || m.s || m.instId) === symbol);
    return { ...p, markPriceData: mp };
  });

  const getSymbol = (item: any) => item.symbol || item.s || item.instId || 'Unknown';
  const getLastPrice = (item: any) => parseFloat(item.lastPrice || item.c || item.last || 0);
  const getChange = (item: any) => parseFloat(item.priceChangePercent || item.changeRate || item.P || 0);
  const getVolume = (item: any) => parseFloat(item.quoteVolume || item.volCcy24h || item.v || 0);
  const getMarkPrice = (mp: any) => mp ? parseFloat(mp.markPrice || mp.markPx || 0) : 0;
  const getIndexPrice = (mp: any) => mp ? parseFloat(mp.indexPrice || mp.idxPx || 0) : 0;
  const getFundingRate = (mp: any) => mp ? parseFloat(mp.fundingRate || mp.funding || 0) : 0;

  return (
    <div style={{ padding: 32, background: '#0a0a0a', minHeight: '100%', color: '#fff', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(249,115,22,0.4)' }}>
          <Activity size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>SoDEX Markets</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0 0' }}>Live Spot & Perpetual Futures</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #222', paddingBottom: 16 }}>
        <button
          onClick={() => setTab('spot')}
          style={{ padding: '8px 24px', borderRadius: 8, background: tab === 'spot' ? '#1a1a1a' : 'transparent', border: tab === 'spot' ? '1px solid #333' : '1px solid transparent', color: tab === 'spot' ? '#fff' : '#666', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
        >
          Spot Markets
        </button>
        <button
          onClick={() => setTab('perps')}
          style={{ padding: '8px 24px', borderRadius: 8, background: tab === 'perps' ? '#1a1a1a' : 'transparent', border: tab === 'perps' ? '1px solid #333' : '1px solid transparent', color: tab === 'perps' ? '#fff' : '#666', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
        >
          Perpetual Futures
        </button>
      </div>

      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#161616', borderBottom: '1px solid #222' }}>
              <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '.1em' }}>SYMBOL</th>
              <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '.1em' }}>PRICE</th>
              <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '.1em' }}>24H CHANGE</th>
              <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '.1em' }}>24H VOL (USDT)</th>
              {tab === 'perps' && (
                <>
                  <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '.1em' }}>MARK / INDEX</th>
                  <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '.1em' }}>FUNDING RATE</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#555', fontSize: 14 }}>Loading markets...</td>
              </tr>
            ) : tab === 'spot' ? (
              spotTickers.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: 14 }}>{getSymbol(t)}</td>
                  <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: 14 }}>${getLastPrice(t).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: getChange(t) >= 0 ? '#00e676' : '#f43f5e', fontSize: 13, fontWeight: 600 }}>
                      {getChange(t) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {Math.abs(getChange(t)).toFixed(2)}%
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: 13, color: '#888' }}>${getVolume(t).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                </tr>
              ))
            ) : (
              mergedPerps.map((p, i) => {
                const mp = p.markPriceData;
                const change = getChange(p);
                const fr = getFundingRate(mp);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: 14 }}>{getSymbol(p)}</td>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: 14 }}>${getLastPrice(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: change >= 0 ? '#00e676' : '#f43f5e', fontSize: 13, fontWeight: 600 }}>
                        {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(change).toFixed(2)}%
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: 13, color: '#888' }}>${getVolume(p).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace', marginBottom: 2 }}>M: ${getMarkPrice(mp).toLocaleString('en-US', { maximumFractionDigits: 4 })}</div>
                      <div style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>I: ${getIndexPrice(mp).toLocaleString('en-US', { maximumFractionDigits: 4 })}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ color: fr > 0 ? '#f97316' : '#3b82f6', fontSize: 13, fontWeight: 600 }}>
                        {(fr * 100).toFixed(4)}%
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            
            {!loading && ((tab === 'spot' && spotTickers.length === 0) || (tab === 'perps' && perpsTickers.length === 0)) && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#555', fontSize: 14 }}>No data available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
