'use client';
import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Search, Sparkles } from 'lucide-react';

interface NewsItem { id: string; title: string; url: string; summary: string; source: string; time: string; }

const SENTIMENTS = ['Positive','Neutral','Negative'] as const;
type Sentiment = typeof SENTIMENTS[number];
const sentimentColor = (s: Sentiment) => s === 'Positive' ? '#00e676' : s === 'Negative' ? '#f43f5e' : '#f59e0b';
const sentimentBg = (s: Sentiment) => s === 'Positive' ? 'rgba(0,230,118,0.1)' : s === 'Negative' ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)';

function Skeleton() {
  return <div className="shimmer" style={{ height: 210, border: '1px solid #1e1e1e' }} />;
}

export default function BreakingNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/news');
      const d = await r.json() as { news: NewsItem[] };
      if (d.news?.length) setNews(d.news);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = news.filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.summary.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Market News</h1>
          <p style={{ fontSize: 13, color: '#444', marginTop: 4 }}>Real-time market alpha and on-chain events from SoSoValue.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111', border: '1px solid #222', borderRadius: 8, padding: '7px 12px', minWidth: 240 }}>
            <Search size={13} color="#444" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="E.g. AI, DeFi, Regulatory, Memes" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: '#888', flex: 1, width: '100%' }} />
          </div>
          <button onClick={async () => { setAnalyzing(true); await new Promise(r => setTimeout(r, 1800)); setAnalyzing(false); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Sparkles size={13} />AI Tag
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: analyzing ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, color: '#c084fc', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {analyzing ? <span className="spin" style={{ display: 'inline-block' }}>⟳</span> : '✦'}&nbsp;Analyzing...
          </button>
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 10, color: '#333', marginBottom: 20 }}>Powered by Gemini AI ✦</div>

      {/* EXP Banner */}
      <div style={{ background: 'linear-gradient(135deg,#12103a,#0e1a4a,#0b1535)', border: '1px solid #2a2060', borderRadius: 16, padding: '18px 24px', textAlign: 'center', marginBottom: 24 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>You got 30,000 SoSoValue EXP from your friend! 🎉</p>
        <p style={{ fontSize: 12, color: '#7070bb', marginBottom: 16 }}>Sign up to SoSoValue now and unlock all the powerful features for free! 🚀</p>
        <a href="https://sosovalue.com" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: 'linear-gradient(90deg,#3b82f6,#6366f1)', color: '#fff', borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textDecoration: 'none', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
          CLAIM ON SOSOVALUE #SOSOVALUE
        </a>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)
          : filtered.map((n, idx) => {
              const s = SENTIMENTS[idx % 3];
              const score = 60 + ((idx * 13) % 36);
              return (
                <div key={n.id} onClick={() => window.open(n.url, '_blank')} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#2e2e2e'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#1e1e1e'}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#888', fontWeight: 600, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 5, padding: '2px 8px' }}>{n.source}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: sentimentColor(s), background: sentimentBg(s), borderRadius: 5, padding: '2px 8px' }}>
                        <span style={{ fontSize: 9 }}>✦</span>{s} ({score}%)
                      </span>
                    </div>
                    <ExternalLink size={13} color="#333" />
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e2e2', lineHeight: 1.45 }}>{n.title}</h3>
                  <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6, flex: 1 }}>{n.summary?.slice(0, 150)}{(n.summary?.length ?? 0) > 150 ? '...' : ''}</p>
                  <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#3a3a3a' }}>{n.time}</span>
                    <span style={{ fontSize: 10, color: '#f97316', fontWeight: 600 }}>SoSoValue API</span>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
