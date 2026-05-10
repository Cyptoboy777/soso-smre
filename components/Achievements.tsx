'use client';
import { Award, Zap, Target, ShieldCheck } from 'lucide-react';

export default function Achievements({ soPoints = 0, tradeCount = 0 }) {
  const list = [
    { label: 'Fast Starter', desc: 'Complete 5 trades', icon: Zap, unlocked: tradeCount >= 5, color: '#3b82f6' },
    { label: 'Point Grinder', desc: 'Earn 1000 SoPoints', icon: Award, unlocked: soPoints >= 1000, color: '#f59e0b' },
    { label: 'Risk Manager', desc: 'First profitable trade', icon: ShieldCheck, unlocked: tradeCount > 0, color: '#00e676' },
    { label: 'Alpha Seeker', desc: 'Perform AI Analysis', icon: Target, unlocked: true, color: '#f97316' },
  ];

  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', marginBottom: 16 }}>ACHIEVEMENTS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {list.map(a => (
          <div key={a.label} style={{ 
            background: '#111', 
            border: `1px solid ${a.unlocked ? a.color + '30' : '#1a1a1a'}`, 
            borderRadius: 12, 
            padding: 12,
            opacity: a.unlocked ? 1 : 0.4,
            filter: a.unlocked ? 'none' : 'grayscale(1)',
            transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <a.icon size={14} color={a.unlocked ? a.color : '#444'} />
              <span style={{ fontSize: 12, fontWeight: 700, color: a.unlocked ? '#fff' : '#444' }}>{a.label}</span>
            </div>
            <p style={{ fontSize: 9, color: '#555', margin: 0 }}>{a.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
