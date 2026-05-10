'use client';
import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Award, Zap } from 'lucide-react';

interface Performer {
  name: string;
  roi: string;
  balance: string;
  points: number;
}

export default function LeaderboardPage() {
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        if (d.performers) setPerformers(d.performers);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Trophy color="#f59e0b" size={32} /> RANKINGS
        </h1>
        <p style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Global performance tracking for all SoSo SMRE traders.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 48 }}>
         {/* Top 3 Podium Mockup */}
         {[
           { rank: 2, name: 'SosoMaster', roi: '+89.2%', color: '#94a3b8' },
           { rank: 1, name: 'AlphaWhale', roi: '+142.5%', color: '#f59e0b' },
           { rank: 3, name: 'CryptoKing', roi: '+67.8%', color: '#b45309' },
         ].sort((a,b) => a.rank - b.rank).map((top, i) => (
           <div key={i} style={{ 
             background: '#0a0a0a', 
             border: `1px solid ${top.color}30`, 
             borderRadius: 20, 
             padding: 24, 
             textAlign: 'center',
             position: 'relative',
             overflow: 'hidden',
             transform: top.rank === 1 ? 'scale(1.05)' : 'scale(1)',
             boxShadow: top.rank === 1 ? `0 0 40px ${top.color}15` : 'none'
           }}>
             {top.rank === 1 && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, background: top.color }} />}
             <div style={{ fontSize: 10, fontWeight: 900, color: top.color, marginBottom: 16 }}>RANK #{top.rank}</div>
             <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#111', border: `2px solid ${top.color}`, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
               {top.name[0]}
             </div>
             <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{top.name}</div>
             <div style={{ fontSize: 14, fontWeight: 700, color: '#00e676' }}>{top.roi} ROI</div>
           </div>
         ))}
      </div>

      <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 20, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
              <th style={{ padding: '20px 24px', fontSize: 11, color: '#444', fontWeight: 800 }}>TRADER</th>
              <th style={{ padding: '20px 24px', fontSize: 11, color: '#444', fontWeight: 800 }}>ROI (24H)</th>
              <th style={{ padding: '20px 24px', fontSize: 11, color: '#444', fontWeight: 800 }}>BALANCE</th>
              <th style={{ padding: '20px 24px', fontSize: 11, color: '#444', fontWeight: 800 }}>SO-POINTS</th>
            </tr>
          </thead>
          <tbody>
            {performers.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #111', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#0d0d0d'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{p.name[0]}</div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{p.name}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 700, color: p.roi.startsWith('+') ? '#00e676' : '#f43f5e' }}>{p.roi}</td>
                <td style={{ padding: '16px 24px', fontSize: 14, color: '#888', fontFamily: 'monospace' }}>{p.balance}</td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                    <Zap size={14} fill="#f59e0b" /> {p.points.toLocaleString()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
