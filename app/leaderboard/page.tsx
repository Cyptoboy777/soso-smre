'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, Zap, TrendingUp, Sparkles } from 'lucide-react';

interface Performer {
  name: string;
  roi: string;
  balance: string;
  points: number;
}

const rankGlow = (rank: number) => {
  if (rank === 1) return '0 0 25px rgba(251,191,36,0.2)';
  if (rank === 2) return '0 0 20px rgba(148,163,184,0.15)';
  return '0 0 15px rgba(180,83,9,0.12)';
};

const podiumVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as any
    }
  })
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4 } }
};

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

  const topPodium = [
    { rank: 2, name: 'SosoMaster', roi: '+89.2%', color: '#94a3b8', avatar: '🥈' },
    { rank: 1, name: 'AlphaWhale', roi: '+142.5%', color: '#fbbf24', avatar: '👑' },
    { rank: 3, name: 'CryptoKing', roi: '+67.8%', color: '#b45309', avatar: '🥉' },
  ].sort((a, b) => a.rank - b.rank);

  return (
    <div className="scroll-track" style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto', overflowY: 'auto', height: '100%' }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 54 }}>
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 12 }}
        >
          <Trophy color="#fbbf24" size={36} style={{ filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.4))' }} />
          <h1 className="gradient-text" style={{ fontSize: 36, fontWeight: 950, letterSpacing: '-0.04em', textTransform: 'uppercase', margin: 0 }}>
            Global Rankings
          </h1>
        </motion.div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, marginTop: 4 }}>
          Real-time ROI leaderboard and performance tracking for SoSo SMRE traders.
        </p>
      </div>

      {/* Podium */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr 1fr', gap: 24, marginBottom: 54, alignItems: 'end' }}>
        {topPodium.map((top, idx) => (
          <motion.div
            key={top.rank}
            custom={idx}
            variants={podiumVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
            className="glass"
            style={{ 
              borderRadius: 24, 
              padding: top.rank === 1 ? '40px 24px' : '30px 20px', 
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              border: `1px solid ${top.color}40`,
              boxShadow: rankGlow(top.rank),
              background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.6) 100%)'
            }}
          >
            {top.rank === 1 && (
              <div style={{ 
                position: 'absolute', top: 0, left: 0, right: 0, height: 4, 
                background: 'linear-gradient(90deg, #fbbf24, #f59e0b)' 
              }} />
            )}
            
            <div style={{ fontSize: 10, fontWeight: 900, color: top.color, letterSpacing: '.2em', marginBottom: 18 }}>
              RANK #{top.rank}
            </div>

            {/* Avatar block */}
            <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 18px' }}>
              <div style={{ 
                position: 'absolute', inset: 0, borderRadius: '50%', 
                border: `2.5px solid ${top.color}`, 
                background: `radial-gradient(circle, ${top.color}15, transparent)` 
              }} />
              <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: '#0a0a14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                {top.avatar}
              </div>
            </div>

            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 6, letterSpacing: '-0.02em' }}>{top.name}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <TrendingUp size={16} /> {top.roi}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, fontWeight: 600 }}>Active Platform Trader</div>
          </motion.div>
        ))}
      </div>

      {/* Performers Table */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="glass" 
        style={{ borderRadius: 24, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} color="var(--accent-orange)" />
          <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '.18em' }}>TOP TRADING PERFORMANCES</span>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '18px 24px', fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.08em' }}>TRADER</th>
              <th style={{ padding: '18px 24px', fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.08em' }}>ROI (24H)</th>
              <th style={{ padding: '18px 24px', fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.08em' }}>BALANCE</th>
              <th style={{ padding: '18px 24px', fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.08em' }}>SO-POINTS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div className="spin" style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid var(--accent-orange)', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: 8 }} />
                  <div>Loading global performance profiles...</div>
                </td>
              </tr>
            ) : (
              performers.map((p, i) => (
                <motion.tr 
                  key={i} 
                  variants={itemVariants}
                  style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s', cursor: 'pointer' }} 
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} 
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ 
                        width: 34, height: 34, borderRadius: 10, 
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', 
                        border: '1px solid var(--border-bold)', 
                        display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', 
                        fontSize: 14, fontWeight: 900, color: 'var(--accent-orange2)' 
                      }}>
                        {p.name[0]}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 800, color: p.roi.startsWith('+') ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {p.roi}
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {p.balance}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>
                      <Zap size={14} fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.3))' }} /> 
                      {p.points.toLocaleString()}
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
