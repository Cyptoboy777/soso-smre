'use client';

import { motion } from 'framer-motion';
import { generateAIBias } from '@/lib/tradeMath';
import { fmtPrice, fmtVol } from '@/lib/sodex';
import { Brain, TrendingUp, TrendingDown, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Ticker } from '@/types/sodex';

interface Props {
  selected: Ticker | null;
}

export default function MarketAnalysisEngine({ selected }: Props) {
  if (!selected) {
    return (
      <div style={{ padding: 16, background: '#0a0a14', borderBottom: '1px solid #1e1e3a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        <span style={{ fontSize: 11, color: '#44446a', fontWeight: 800 }}>AWAITING MARKET DATA</span>
      </div>
    );
  }

  const { bias, confidence, reasoning, expectedRR, winProbability } = generateAIBias(selected.priceChangePct, selected.quoteVolume);
  
  const biasColor = bias === 'BULLISH' ? '#00e676' : bias === 'BEARISH' ? '#f43f5e' : '#f59e0b';
  const BiasIcon = bias === 'BULLISH' ? TrendingUp : bias === 'BEARISH' ? TrendingDown : Activity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#0a0a14', borderBottom: '1px solid #1e1e3a' }}>
      
      {/* 24H STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#1e1e3a' }}>
        {[
          ['24H High', `$${fmtPrice(selected.high)}`, '#00e676'],
          ['24H Low', `$${fmtPrice(selected.low)}`, '#f43f5e'],
          ['24H Vol', fmtVol(selected.quoteVolume), '#8888aa'],
          ['24H Change', `${selected.priceChangePct >= 0 ? '+' : ''}${selected.priceChangePct.toFixed(2)}%`, selected.priceChangePct >= 0 ? '#00e676' : '#f43f5e']
        ].map(([lbl, val, col]) => (
          <div key={lbl} style={{ background: '#0a0a14', padding: '10px 16px' }}>
            <div style={{ fontSize: 9, color: '#44446a', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 2 }}>{lbl}</div>
            <div style={{ fontSize: 12, color: col, fontWeight: 900, fontFamily: 'monospace' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* AI BIAS ENGINE */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Brain size={14} color="#a78bfa" />
            <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 900, letterSpacing: '0.1em' }}>AI TRADE BIAS</span>
          </div>
          <div style={{ fontSize: 10, color: '#44446a', fontWeight: 800 }}>CONFIDENCE: <span style={{ color: '#fff' }}>{confidence}%</span></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
          <div style={{ width: 4, borderRadius: 4, background: biasColor }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <BiasIcon size={14} color={biasColor} />
              <span style={{ fontSize: 13, color: biasColor, fontWeight: 900, letterSpacing: '0.05em' }}>{bias}</span>
            </div>
            <p style={{ fontSize: 10, color: '#8888aa', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
              {reasoning}
            </p>
          </div>
        </div>

        {/* Advanced AI metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#44446a', fontWeight: 800 }}>EXPECTED R:R</span>
            <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 900, fontFamily: 'monospace' }}>{expectedRR}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#44446a', fontWeight: 800 }}>WIN PROB</span>
            <span style={{ fontSize: 11, color: '#00e676', fontWeight: 900, fontFamily: 'monospace' }}>{winProbability}</span>
          </div>
        </div>

        {/* AI Setup suggestion */}
        <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <ShieldCheck size={12} color="#f97316" />
            <span style={{ fontSize: 9, color: '#f97316', fontWeight: 900, letterSpacing: '0.05em' }}>SMART MONEY ZONES</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: '#44446a' }}>SUP</span>
              <span style={{ color: '#00e676' }}>${fmtPrice(selected.low + (selected.high - selected.low) * 0.2)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <span style={{ color: '#44446a' }}>POC</span>
              <span style={{ color: '#8888aa' }}>${fmtPrice((selected.high + selected.low) / 2)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
              <span style={{ color: '#44446a' }}>RES</span>
              <span style={{ color: '#f43f5e' }}>${fmtPrice(selected.high - (selected.high - selected.low) * 0.2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
