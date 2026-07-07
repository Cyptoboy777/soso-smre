import { BookOpen } from 'lucide-react';

const SECTIONS = [
  { icon: '💼', title: 'Account & Portfolio Sync',  color: '#2bd9a8', text: 'Every user starts with $10,000 USDC in paper funds. We use a Dual-Sync architecture: localStorage for zero-latency UI updates, and Firebase Firestore for permanent cloud backup. Reset anytime in the Portfolio tab.' },
  { icon: '🤖', title: 'SoSo AI-Trader & Freqtrade', color: '#f97316', text: 'The autonomous trading agent uses Gemini 2.5 Flash & Groq LLaMA 3. It features Freqtrade-inspired advanced controls: Multi-Exchange Routing (SoDEX default), Max Open Trades, and Dynamic Trailing Stop-Losses.' },
  { icon: '🐕', title: 'SoDoggy Assistant & Audio', color: '#ec4899', text: 'Our Cyberpunk Dog acts as your personal AI copilot. He reacts dynamically to markets. Turn on the "Quick Market Podcast" for an endless, background audio stream summarizing top crypto news and live metrics while you browse.' },
  { icon: '📈', title: 'Top 50 Assets & SoDEX',   color: '#3b82f6', text: 'We natively support the Top 50 global crypto pairs with real-time pricing sourced from CoinGecko. The dedicated SoDEX Markets dashboard routes high-performance spot tickers via api.sodex.xyz.' },
  { icon: '⚠️', title: 'Risk Warning (Simulation)', color: '#ff6b6b', text: 'SoSo SMRE is a trading simulation platform built for the SoSoValue Buildathon. All AI signals and automated executions are simulated and for educational/research purposes only. DYOR.' },
  { icon: '✈️', title: 'Telegram Social Alpha',     color: '#4f9cff', text: 'Get real-time push notifications straight to your Telegram. The system instantly broadcasts AI trade executions, dynamic target shifts, and breaking SoSoValue news alerts to your mobile device.' },
];

export default function GuidelinesPage() {
  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <BookOpen size={20} color="#f97316" />
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '.05em' }}>Guidelines & Architecture</h1>
      </div>
      <p style={{ fontSize: 13, color: '#555', marginBottom: 24, fontWeight: 700, letterSpacing: '.05em' }}>SoSo SMRE — SoSoValue Buildathon Edition</p>

      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px', marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', lineHeight: 1.65 }}>
          Welcome to <span style={{ color: '#4f9cff', fontWeight: 800 }}>SoSo SMRE</span> — the ultimate Single-Person Agentic Finance Business. Built to bridge the gap between institutional market intelligence (SoSoValue) and autonomous execution (SoDEX / Freqtrade), this platform allows anyone to run a completely automated, AI-driven quantitative fund.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SECTIONS.map(s => (
          <div key={s.title} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 14, padding: '18px 20px', borderLeft: `4px solid ${s.color}`, transition: '0.2s', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: s.color, letterSpacing: '.05em', textTransform: 'uppercase' }}>{s.title}</h3>
            </div>
            <p style={{ fontSize: 12, color: '#888', lineHeight: 1.65, paddingLeft: 30, fontWeight: 500 }}>{s.text}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: '14px 20px', background: 'transparent', border: '1px dashed #1e293b', borderRadius: 12, fontSize: 10, color: '#475569', textAlign: 'center', lineHeight: 1.7, fontWeight: 700, letterSpacing: '.05em' }}>
        v2.4 (Buildathon Wave 2) · Next.js 15 + Tailwind · AI Models: Gemini & Groq · APIs: SoSoValue, SoDEX, CoinGecko · Not Financial Advice
      </div>
    </div>
  );
}
