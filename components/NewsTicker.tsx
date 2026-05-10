'use client';
import { useEffect, useState } from 'react';

export default function NewsTicker() {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/news')
      .then(r => r.json())
      .then((d: { news?: Array<{ title: string }> }) => {
        if (d.news && d.news.length > 3) {
          const titles = d.news.map(n => n.title);
          setItems([...titles, ...titles]);
        }
      })
      .catch(() => {});
  }, []);

  const doubled = items.length ? [...items, ...items] : ['Live news unavailable'];

  return (
    <div style={{ height: 32, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', height: '100%', background: '#111', borderRight: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 6px #00e676' }} />
        <span style={{ fontSize: 10, color: '#00e676', fontWeight: 800, letterSpacing: '.15em' }}>LIVE</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="ticker">
          {doubled.map((h, i) => (
            <span key={i} style={{ fontSize: 11, color: '#999', fontWeight: 500 }}>
              &nbsp;•&nbsp;{h}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
