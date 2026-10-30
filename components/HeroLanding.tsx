'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { LogoMark } from './Logo';
import { FlowField } from './FlowField';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const HeroScene = dynamic(() => import('./HeroScene').then((m) => m.HeroScene), {
  ssr: false,
  loading: () => null,
});

const STEPS = [
  { n: '01', title: 'Data', body: 'SoSoValue ETF flows, hot news, SSI' },
  { n: '02', title: 'Thesis', body: 'Plain-English idea with confidence' },
  { n: '03', title: 'Risk', body: 'Size, drawdown, news-shock gate' },
  { n: '04', title: 'Order', body: 'Confirmed SoDEX testnet limit' },
];

export function HeroLanding() {
  const reduce = useReducedMotion();
  const [show3d, setShow3d] = useState(false);
  useEffect(() => {
    if (reduce) return;
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      if (!cancelled) setShow3d(true);
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(go, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(go, 1800);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [reduce]);
  return (
    <section
      className="hero-landing glass-hero"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--line)',
        marginBottom: 24,
        minHeight: 340,
      }}
    >
      <FlowField />
      {show3d && !reduce ? (
        <div className="hero-3d-layer">
          <HeroScene reduceMotion={false} />
        </div>
      ) : null}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'clamp(28px, 5vw, 48px)',
          display: 'grid',
          gap: 28,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 'clamp(16px, 3vw, 28px)',
            alignItems: 'center',
          }}
          className="hero-top"
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.86, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: 'drop-shadow(0 18px 40px rgba(255,79,32,0.28))' }}
          >
            <LogoMark size={96} />
          </motion.div>
          <div>
            <motion.p
              className="hero-kicker"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5 }}
            >
              SoSoValue Wave 3 · FlowSentinel
            </motion.p>
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{
                margin: '0 0 12px',
                fontSize: 'clamp(2rem, 5.5vw, 3.4rem)',
                letterSpacing: '-0.045em',
                lineHeight: 1.05,
                fontWeight: 650,
                textWrap: 'balance',
                maxWidth: 16 * 28,
              }}
            >
              Watch the flow.
              <br />
              <span style={{ color: 'var(--accent-soft)' }}>Act with a gate.</span>
            </motion.h1>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.55 }}
              style={{
                margin: 0,
                color: 'var(--text-muted)',
                fontSize: 'clamp(15px, 2vw, 17px)',
                maxWidth: 520,
                textWrap: 'pretty',
              }}
            >
              A one-person fund desk: SoSoValue data becomes a daily thesis, a risk check you can
              read, and a confirmed SoDEX testnet order — with an honest public track record.
            </motion.p>
          </div>
        </div>

        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          {STEPS.map((s, i) => (
            <motion.li
              key={s.n}
              className="glass-card step-card"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.22 + Math.min(i * 0.06, 0.28),
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
              }}
              style={{ padding: '14px 16px' }}
            >
              <div style={{ fontSize: 11, color: 'var(--accent-soft)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                {s.n}
              </div>
              <div style={{ fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.body}</div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
