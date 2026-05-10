'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

interface Signal { signal: 'BUY'|'SELL'|'HOLD'; reasoning: string; confidence: number; stopLoss: string; target: string; timeframe: string; riskLevel: 'LOW'|'MEDIUM'|'HIGH'; }
interface HistoryItem { asset: string; tf: string; signal: string; confidence: number; ts: number; }
interface NewsItem { title: string; source: string; time: string; url: string; }

const TF = ['1M','5M','15M','30M','1H','4H','8H','12H','1D','1W'];
const ASSETS = ['BTC','ETH','SOL','BNB','XRP','AVAX','SOSO'];
const sigColor = (s: string) => s === 'BUY' ? '#00e676' : s === 'SELL' ? '#f43f5e' : '#f59e0b';
const riskColor = (r: string) => r === 'LOW' ? '#00e676' : r === 'HIGH' ? '#f43f5e' : '#f59e0b';

export default function AIAnalysisPage() {
  const [asset, setAsset] = useState('BTC');
  const [tf, setTf] = useState('1H');
  const [buyZone, setBuyZone] = useState('');
  const [sellZone, setSellZone] = useState('');
  const [loading, setLoading] = useState(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [currentPrice, setCurrentPrice] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [autoActive, setAutoActive] = useState(false);
  const [model, setModel] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/news').then(r => r.json())
      .then((d: { news?: NewsItem[] }) => { if (d.news) setNews(d.news.slice(0, 3)); })
      .catch(() => {});
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!asset.trim() || loading) return;
    setLoading(true);
    try {
      const r = await fetch('/api/ai-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: asset.toUpperCase(), riskProfile: 'Moderate', timeframe: tf, buyZone, sellZone }),
      });
      const d = await r.json() as { signal?: Signal; model?: string; price?: string; change?: string; error?: string };
      if (!r.ok) throw new Error(d.error ?? 'Live AI analysis failed');
      if (d.signal) {
        const nextSignal = d.signal;
        setSignal(nextSignal);
        setModel(d.model ?? '');
        setCurrentPrice(d.price ?? '');
        setError('');
        setHistory(h => [{ asset: asset.toUpperCase(), tf, signal: nextSignal.signal, confidence: nextSignal.confidence, ts: Date.now() }, ...h.slice(0, 4)]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Live AI analysis failed');
    }
    setLoading(false);
  }, [asset, tf, buyZone, sellZone, loading]);

  // Auto analysis
  useEffect(() => {
    if (!autoActive) return;
    runAnalysis();
    const id = setInterval(runAnalysis, 30000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoActive]);

  const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sub-header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: '#555' }}>Smart Money Research Engine — Dual-model validation.</span>
        <span style={{ fontSize: 10, color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 5, padding: '2px 8px', fontWeight: 700, letterSpacing: '.06em' }}>POWERED BY SOSOVALUE DATA</span>
      </div>

      {/* 3 columns */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT: Signal Generator */}
        <div style={{ ...col, width: 278, background: '#0d0d0d', borderRight: '1px solid #1e1e1e' }}>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <TrendingUp size={16} color="#f97316" />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Signal Generator</span>
            </div>
            <p style={{ fontSize: 11, color: '#444', marginBottom: 20 }}>Select asset and timeframe to analyze.</p>

            <label style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', display: 'block', marginBottom: 6 }}>ASSET PAIR</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              <Search size={13} color="#444" />
              <select value={asset} onChange={e => setAsset(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#fff', fontWeight: 600, flex: 1, cursor: 'pointer', appearance: 'none' }}>
                {ASSETS.map(a => <option key={a} value={a} style={{ background: '#111' }}>{a} / USDC</option>)}
              </select>
            </div>

            <label style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', display: 'block', marginBottom: 6 }}>TIMEFRAME</label>
            <select value={tf} onChange={e => setTf(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 14, outline: 'none', cursor: 'pointer', marginBottom: 14 }}>
              {TF.map(t => <option key={t}>{t}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>BUY ZONE (OPTIONAL)</label>
                <input value={buyZone} onChange={e => setBuyZone(e.target.value)} placeholder="e.g. $90k" style={{ width: '100%', padding: '7px 10px', borderRadius: 7, background: '#111', border: '1px solid #2a2a2a', color: '#888', fontSize: 12, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>SELL ZONE (OPTIONAL)</label>
                <input value={sellZone} onChange={e => setSellZone(e.target.value)} placeholder="e.g. $100k" style={{ width: '100%', padding: '7px 10px', borderRadius: 7, background: '#111', border: '1px solid #2a2a2a', color: '#888', fontSize: 12, outline: 'none' }} />
              </div>
            </div>

            {/* Model badges */}
            {[{ label: 'Groq (llama-3.3)', tag: 'Fast Output', color: '#06b6d4', icon: 'G' }, { label: 'Gemini (2.5-flash)', tag: 'Deep Reasoning', color: '#f97316', icon: '✦' }].map(m => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${m.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: m.color, fontWeight: 700 }}>{m.icon}</div>
                  <span style={{ fontSize: 12, color: '#aaa' }}>{m.label}</span>
                </div>
                <span style={{ fontSize: 10, color: m.color, background: `${m.color}15`, border: `1px solid ${m.color}40`, borderRadius: 5, padding: '2px 7px', fontWeight: 700 }}>{m.tag}</span>
              </div>
            ))}

            <button onClick={() => { setAutoActive(a => !a); if (!autoActive) runAnalysis(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 11, borderRadius: 10, background: autoActive ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.08)', border: `1px solid ${autoActive ? 'rgba(6,182,212,0.6)' : 'rgba(6,182,212,0.25)'}`, color: '#06b6d4', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: autoActive ? '0 0 16px rgba(6,182,212,0.2)' : 'none', marginBottom: 10, marginTop: 4, letterSpacing: '.04em' }}>
              <TrendingUp size={14} />AUTO-ANALYSIS ACTIVE
            </button>
            <button onClick={runAnalysis} disabled={loading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px', borderRadius: 10, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', color: '#f97316', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              <RefreshCw size={13} className={loading ? 'spin' : ''} />{loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>

          {/* Recent History */}
          {history.length > 0 && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Clock size={12} color="#444" />
                <span style={{ fontSize: 12, color: '#444', fontWeight: 600 }}>Recent History</span>
              </div>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#ccc', fontWeight: 600 }}>{h.asset} <span style={{ color: '#444', fontSize: 10 }}>{h.tf}</span></span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sigColor(h.signal) }}>{h.signal}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CENTER: Analysis Results */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#0a0a0a' }}>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 18, height: 18, background: 'rgba(6,182,212,0.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={11} color="#06b6d4" /></div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Analysis Results</h2>
            </div>
            {signal && <p style={{ fontSize: 12, color: '#444', marginBottom: 20 }}>Target: {asset} • Timeframe: {tf}{currentPrice ? ` • $${parseFloat(currentPrice).toLocaleString()}` : ''}{model ? ` • ${model}` : ''}</p>}

            {!signal && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, height: 280, gap: 12 }}>
                <Search size={32} color="#2a2a2a" />
                <span style={{ fontSize: 14, color: '#333' }}>Ready for computation...</span>
                <span style={{ fontSize: 11, color: '#2a2a2a' }}>Configure asset & run analysis</span>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, height: 280, gap: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="bounce-1" style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316' }} />
                  <div className="bounce-2" style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316' }} />
                  <div className="bounce-3" style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316' }} />
                </div>
                <span style={{ fontSize: 13, color: '#555' }}>Dual-model analysis running...</span>
                <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                  <span style={{ color: '#06b6d4' }}>⚡ Groq processing...</span>
                  <span style={{ color: '#f97316' }}>✦ Gemini reasoning...</span>
                </div>
              </div>
            )}

            {signal && !loading && (
              <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* PRIMARY SIGNAL */}
                <div style={{ background: '#111', border: `1px solid ${sigColor(signal.signal)}25`, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px' }}>
                  <span style={{ fontSize: 10, color: '#444', letterSpacing: '.15em', fontWeight: 700, marginBottom: 10 }}>PRIMARY SIGNAL</span>
                  <span className={signal.signal === 'BUY' ? 'buy-glow' : signal.signal === 'SELL' ? 'sell-glow' : ''} style={{ fontSize: 60, fontWeight: 900, color: sigColor(signal.signal), letterSpacing: '.04em', lineHeight: 1 }}>{signal.signal}</span>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[
                    { l: 'CONFIDENCE', v: `${signal.confidence}%`, c: '#fff' },
                    { l: 'RISK LEVEL', v: signal.riskLevel, c: riskColor(signal.riskLevel) },
                    { l: 'BUY ZONE', v: signal.stopLoss, c: '#00e676' },
                    { l: 'SELL ZONE', v: signal.target, c: '#f43f5e' },
                  ].map(s => (
                    <div key={s.l} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#444', letterSpacing: '.12em', fontWeight: 700, marginBottom: 8 }}>{s.l}</div>
                      <div style={{ fontSize: s.l === 'CONFIDENCE' ? 24 : 14, fontWeight: 800, color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {/* Reasoning */}
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 16, height: 16, background: 'rgba(6,182,212,0.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#06b6d4' }}>✦</div>
                    <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, letterSpacing: '.1em' }}>ANALYTIC REASONING</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#bbb', lineHeight: 1.65 }}>{signal.reasoning}</p>
                </div>

                {/* DYOR */}
                <div style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={14} color="#f97316" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600, letterSpacing: '.04em', lineHeight: 1.5 }}>NOTE: THIS AI ANALYSIS IS FOR INFORMATIONAL PURPOSES ONLY. DO YOUR OWN RESEARCH (DYOR).</span>
                </div>

                {/* CTA */}
                <a href={`/ai-trade-agent?asset=${asset}&stopLoss=${signal.stopLoss.replace(/[^0-9.]/g, '')}&target=${signal.target.replace(/[^0-9.]/g, '')}`} style={{ textDecoration: 'none' }}>
                  <button style={{ width: '100%', padding: 15, borderRadius: 12, background: signal.signal === 'BUY' ? 'linear-gradient(90deg,#00c853,#00e676)' : signal.signal === 'SELL' ? 'linear-gradient(90deg,#c62828,#f43f5e)' : 'linear-gradient(90deg,#e65100,#f97316)', color: '#000', border: 'none', fontSize: 14, fontWeight: 800, letterSpacing: '.06em', cursor: 'pointer', boxShadow: signal.signal === 'BUY' ? '0 0 24px rgba(0,230,118,0.35)' : '0 0 24px rgba(249,115,22,0.35)' }}>
                    STEP 2: EXECUTE {signal.signal} TRADE
                  </button>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Market Context */}
        <div style={{ ...col, width: 282, background: '#0d0d0d', borderLeft: '1px solid #1e1e1e' }}>
          <div style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Market Context</h3>
            <p style={{ fontSize: 11, color: '#444', marginBottom: 18 }}>Real-time news for {asset}</p>
            {error && <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 10, padding: 12, color: '#fda4af', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>{error}</div>}

            {/* Sentiment Score */}
            {signal && <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: '#666', fontWeight: 600, letterSpacing: '.06em' }}>AI SENTIMENT SCORE</span>
                <span style={{ fontSize: 11, color: sigColor(signal.signal), background: `${sigColor(signal.signal)}1A`, border: `1px solid ${sigColor(signal.signal)}40`, borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>{signal.signal}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 48, fontWeight: 900, color: sigColor(signal.signal), lineHeight: 1 }}>{signal.confidence}</span>
                <span style={{ fontSize: 16, color: '#333', marginBottom: 6 }}>/ 100</span>
              </div>
              <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', background: '#1a1a1a', marginBottom: 8 }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#f43f5e 0%,#555 40%,#555 60%,#00e676 100%)' }} />
                <div style={{ position: 'absolute', top: '50%', left: '85%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#00e676', border: '2.5px solid #000', boxShadow: '0 0 6px #00e676' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, color: '#f43f5e', fontWeight: 700, letterSpacing: '.1em' }}>BEARISH</span>
                <span style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '.1em' }}>NEUTRAL</span>
                <span style={{ fontSize: 9, color: '#00e676', fontWeight: 700, letterSpacing: '.1em' }}>BULLISH</span>
              </div>
            </div>}

            {/* News cards */}
            {news.map((n, i) => (
              <div key={i} onClick={() => window.open(n.url, '_blank')} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 12, marginBottom: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#2a2a2a'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#1e1e1e'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: '#f97316', fontWeight: 700 }}>{n.source}</span>
                  <span style={{ fontSize: 9, color: '#333' }}>{n.time?.slice(0, 8) ?? ''}</span>
                </div>
                <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>{n.title?.slice(0, 88)}{(n.title?.length ?? 0) > 88 ? '...' : ''}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
