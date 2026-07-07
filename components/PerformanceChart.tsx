'use client';
import { useMemo } from 'react';

export default function PerformanceChart({ initialBalance = 10000, currentValue = 10000 }) {
  // Generate some realistic-looking mock historical points if we don't have real history
  // In a production app, we would fetch history from Firestore
  const points = useMemo(() => {
    const data = [];
    const steps = 20;
    const diff = currentValue - initialBalance;
    
    for (let i = 0; i <= steps; i++) {
      // Create a wavy line that ends at the current value
      const progress = i / steps;
      const noise = Math.sin(i * 0.8) * (diff * 0.1);
      const val = initialBalance + (diff * progress) + noise;
      data.push(val);
    }
    // Ensure the last point is exactly the current value
    data[steps] = currentValue;
    return data;
  }, [initialBalance, currentValue]);

  const min = Math.min(...points) * 0.99;
  const max = Math.max(...points) * 1.01;
  const range = max - min;

  // SVG Path calculation
  const width = 800;
  const height = 150;
  
  const pathData = points.map((val, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaPath = `${pathData} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em' }}>EQUITY CURVE (SIMULATED)</div>
        <div style={{ fontSize: 11, color: currentValue >= initialBalance ? '#2bd9a8' : '#ff6b6b', fontWeight: 700 }}>
          {currentValue >= initialBalance ? '+' : ''}{((currentValue - initialBalance) / initialBalance * 100).toFixed(2)}% ALL-TIME
        </div>
      </div>
      
      <div style={{ width: '100%', height: 150, position: 'relative' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={currentValue >= initialBalance ? '#2bd9a8' : '#ff6b6b'} stopOpacity="0.2" />
              <stop offset="100%" stopColor={currentValue >= initialBalance ? '#2bd9a8' : '#ff6b6b'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#grad)" />
          <path d={pathData} fill="none" stroke={currentValue >= initialBalance ? '#2bd9a8' : '#ff6b6b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ fontSize: 9, color: '#333', fontWeight: 700 }}>START: ${initialBalance.toLocaleString()}</div>
        <div style={{ fontSize: 9, color: '#333', fontWeight: 700 }}>CURRENT: ${currentValue.toLocaleString()}</div>
      </div>
    </div>
  );
}
