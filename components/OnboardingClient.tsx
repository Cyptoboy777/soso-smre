'use client';

import Link from 'next/link';
import { useLocale } from './LocaleProvider';
import { BuilderTradePanel } from './BuilderTradePanel';
import type { Thesis } from '@/types/flow';

const DEMO_THESIS: Thesis = {
  id: 'onboard-guided-1',
  createdAt: new Date().toISOString(),
  side: 'LONG',
  symbol: 'vBTC_vUSDC',
  plainEnglish:
    'Guided first trade on testnet. Size is capped. You confirm every step. Not financial advice.',
  confidence: 55,
  entry: 50000,
  stopLoss: 48000,
  takeProfit: 52000,
  drivers: {
    etfBtcNetInflow: null,
    etfEthNetInflow: null,
    ssiChangePct: null,
    newsShock: false,
    topHeadlines: [],
  },
  engine: 'rules',
  horizonHours: 24,
};

export function OnboardingClient() {
  const { t } = useLocale();

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <header style={{ display: 'grid', gap: 10, maxWidth: 720 }}>
        <h1 style={{ margin: 0, letterSpacing: '-0.03em', fontSize: 'clamp(28px, 4vw, 40px)' }}>
          {t.startTitle}
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.55 }}>{t.startLead}</p>
        <p
          className="panel"
          style={{
            margin: 0,
            padding: 14,
            color: 'var(--accent-soft)',
            borderColor: 'rgba(255,79,32,0.35)',
            fontSize: 14,
          }}
        >
          {t.perpsFirst}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{t.realFunds}</p>
      </header>

      <ol
        style={{
          display: 'grid',
          gap: 12,
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {[
          { title: t.stepConnect, body: t.stepConnectBody },
          { title: t.stepApprove, body: t.stepApproveBody },
          { title: t.stepTrade, body: t.stepTradeBody },
        ].map((step) => (
          <li key={step.title} className="panel" style={{ padding: 16 }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>{step.title}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.45 }}>
              {step.body}
            </span>
          </li>
        ))}
      </ol>

      <BuilderTradePanel thesis={DEMO_THESIS} quantity={0.0001} />

      <Link href="/" className="btn btn-primary" style={{ justifySelf: 'start' }}>
        {t.onboardingCta}
      </Link>
    </div>
  );
}
