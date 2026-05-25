'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function SodexChart({ symbol, lastPrice }: { symbol: string; lastPrice: number }) {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    // Generate initial mock history for the chart
    const initial = Array.from({ length: 40 }, () => lastPrice * (0.98 + Math.random() * 0.04));
    setPoints(initial);
  }, [symbol]);

  useEffect(() => {
    // Update chart with live price
    const id = setInterval(() => {
      setPoints(prev => [...prev.slice(1), lastPrice]);
    }, 5000);
    return () => clearInterval(id);
  }, [lastPrice]);

  const max = Math.max(...points) * 1.002;
  const min = Math.min(...points) * 0.998;
  const range = max - min;

  const svgWidth = 800;
  const svgHeight = 400;

  const pathData = points.map((p, i) => {
    const x = (i / (points.length - 1)) * svgWidth;
    const y = svgHeight - ((p - min) / range) * svgHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaData = `${pathData} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;

  return (
    <div style={{ width: '100%', height: '100%', background: '#050505', position: 'relative', overflow: 'hidden' }}>
      {/* Grid Lines */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" style={{ position: 'relative', zIndex: 1 }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-orange)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent-orange)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gradient Area */}
        <motion.path
          d={areaData}
          fill="url(#chartGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />

        {/* Price Line */}
        <motion.path
          d={pathData}
          fill="none"
          stroke="var(--accent-orange)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />

        {/* Live Price Dot */}
        {points.length > 0 && (
          <motion.circle
            cx={svgWidth}
            cy={svgHeight - ((points[points.length - 1] - min) / range) * svgHeight}
            r="6"
            fill="var(--accent-orange)"
            animate={{ r: [6, 10, 6], opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </svg>

      {/* Floating Price Labels */}
      <div style={{ position: 'absolute', top: 20, right: 20, textAlign: 'right', zIndex: 2 }}>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800 }}>LIVE TERMINAL FEED</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-orange)', fontFamily: 'monospace' }}>${lastPrice.toLocaleString()}</div>
      </div>
      
      {/* Time Axis */}
      <div style={{ position: 'absolute', bottom: 10, left: 20, display: 'flex', gap: 60, fontSize: 8, color: 'var(--text-dim)', fontWeight: 800 }}>
        <span>10:00</span><span>11:00</span><span>12:00</span><span>13:00</span><span>14:00</span><span>15:00</span><span>NOW</span>
      </div>
    </div>
  );
}
