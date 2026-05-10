'use client';
import { useEffect, useState } from 'react';

export default function MarketSentiment() {
  const [sentiment, setSentiment] = useState(65); // Default to slightly bullish
  const [label, setLabel] = useState('Bullish');

  useEffect(() => {
    // In a real app, we would calculate this based on news sentiment or fear/greed index API
    // For now, let's randomize it slightly to show it's "live"
    const val = 60 + Math.floor(Math.random() * 15);
    setSentiment(val);
    if (val > 70) setLabel('Strong Bullish');
    else if (val > 55) setLabel('Bullish');
    else if (val > 45) setLabel('Neutral');
    else setLabel('Bearish');
  }, []);

  const getColor = () => {
    if (sentiment > 70) return '#00e676';
    if (sentiment > 55) return '#a8ff00';
    if (sentiment > 45) return '#ffeb3b';
    return '#f43f5e';
  };

  return (
    <div style={{ 
      background: 'var(--bg-card)', 
      border: '1px solid var(--border-subtle)', 
      borderRadius: 16, 
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 200,
      height: '100%'
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em', marginBottom: 12, width: '100%' }}>MARKET SENTIMENT</div>
      
      <div style={{ position: 'relative', width: 120, height: 60, overflow: 'hidden' }}>
        {/* Semi-circle gauge background */}
        <div style={{ 
          width: 120, 
          height: 120, 
          borderRadius: '50%', 
          border: '12px solid var(--border-subtle)',
          position: 'absolute',
          top: 0
        }} />
        
        {/* Active gauge part */}
        <div style={{ 
          width: 120, 
          height: 120, 
          borderRadius: '50%', 
          border: `12px solid transparent`,
          borderTopColor: getColor(),
          borderRightColor: sentiment > 50 ? getColor() : 'transparent',
          position: 'absolute',
          top: 0,
          transform: `rotate(${ (sentiment / 100) * 180 - 90 }deg)`,
          transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />

        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          width: '100%', 
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 900,
          color: getColor()
        }}>
          {sentiment}%
        </div>
      </div>
      
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4, fontWeight: 700 }}>SOSOVALUE AI FEED</div>
    </div>
  );
}
