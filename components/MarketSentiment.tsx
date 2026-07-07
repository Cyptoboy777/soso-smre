'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type SentimentLabel = 'Extreme Greed' | 'Greed' | 'Neutral' | 'Fear' | 'Extreme Fear';

const LABEL_CFG: Record<SentimentLabel, { color: string; bg: string; icon: any }> = {
  'Extreme Greed': { color: '#2bd9a8', bg: 'rgba(43,217,168,0.1)',  icon: TrendingUp   },
  'Greed':         { color: '#69f0ae', bg: 'rgba(105,240,174,0.1)', icon: TrendingUp   },
  'Neutral':       { color: '#ffd740', bg: 'rgba(255,215,64,0.1)', icon: Minus        },
  'Fear':          { color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: TrendingDown },
  'Extreme Fear':  { color: '#ff6b6b', bg: 'rgba(255,107,107,0.1)',  icon: TrendingDown },
};

function getLabel(score: number): SentimentLabel {
  if (score >= 75) return 'Extreme Greed';
  if (score >= 55) return 'Greed';
  if (score >= 45) return 'Neutral';
  if (score >= 25) return 'Fear';
  return 'Extreme Fear';
}

export default function MarketSentiment() {
  const [score,   setScore]   = useState<number | null>(null);
  const [fgScore, setFgScore] = useState<number | null>(null); // Alternative.me Fear & Greed
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        // 1. Alternative.me Fear & Greed (most trusted)
        const fgRes = await fetch('https://api.alternative.me/fng/?limit=1');
        const fgData = await fgRes.json();
        const fg = parseInt(fgData?.data?.[0]?.value ?? '50');
        setFgScore(fg);

        // 2. Internal signals: ETF + price
        let derived = fg; // start from real F&G

        try {
          const [etfRes, priceRes] = await Promise.all([
            fetch('/api/etf'),
            fetch('/api/prices'),
          ]);
          const etf   = await etfRes.json();
          const price = await priceRes.json();

          // ETF inflow nudge (cap ±10 points)
          if (etf.totalInflow) {
            const flowNudge = Math.max(-10, Math.min(10, etf.totalInflow / 50_000_000));
            derived += flowNudge;
          }

          // BTC price momentum nudge (cap ±5 points)
          const btcChange = parseFloat(
            price.prices?.find((p: any) => p.symbol === 'BTCUSDT')?.change ?? '0'
          );
          if (btcChange > 3)       derived += 5;
          else if (btcChange > 1)  derived += 2;
          else if (btcChange < -3) derived -= 5;
          else if (btcChange < -1) derived -= 2;
        } catch {}

        setScore(Math.max(2, Math.min(98, Math.round(derived))));
      } catch {
        setScore(50);
      } finally {
        setLoading(false);
      }
    };

    run();
    const id = setInterval(run, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />
    );
  }

  const displayScore = score ?? 50;
  const label        = getLabel(displayScore);
  const cfg          = LABEL_CFG[label];
  const Icon         = cfg.icon;

  // Arc sweep: 0-180° mapped to 0-100 score
  const pct    = displayScore / 100;
  const radius = 52;
  const circ   = Math.PI * radius; // half-circle circumference
  const dash   = pct * circ;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 16,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      height: '100%',
    }}>
      {/* Header */}
      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>
        Market Sentiment
      </div>

      {/* Gauge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <svg width={130} height={72} viewBox="0 0 130 72">
          {/* Track */}
          <path
            d="M 10 65 A 52 52 0 0 1 120 65"
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={10}
            strokeLinecap="round"
          />
          {/* Active arc */}
          <motion.path
            d="M 10 65 A 52 52 0 0 1 120 65"
            fill="none"
            stroke={cfg.color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${cfg.color})` }}
          />
          {/* Score text */}
          <text x="65" y="62" textAnchor="middle" fill={cfg.color} fontSize="22" fontWeight="900" fontFamily="monospace">
            {displayScore}
          </text>
        </svg>

        {/* Label badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 99, padding: '4px 14px' }}>
          <Icon size={11} color={cfg.color}/>
          <span style={{ fontSize: 11, fontWeight: 900, color: cfg.color, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</span>
        </div>
      </div>

      {/* Scale labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '.06em' }}>
        <span style={{ color: '#ff6b6b' }}>FEAR</span>
        <span style={{ color: '#ffd740' }}>NEUTRAL</span>
        <span style={{ color: '#2bd9a8' }}>GREED</span>
      </div>

      {/* Source tag */}
      <div style={{ fontSize: 8, color: 'var(--text-dim)', fontWeight: 700, textAlign: 'center', opacity: 0.6 }}>
        Alt.me F&G + SoSo ETF Flow
        {fgScore !== null && <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.3)' }}>Raw: {fgScore}</span>}
      </div>
    </div>
  );
}
