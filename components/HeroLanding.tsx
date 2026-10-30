'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { LogoMark } from './Logo';
import { FlowField } from './FlowField';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const HeroScene = dynamic(() => import('./HeroScene').then((m) => m.HeroScene), {
  ssr: false,
  loading: () => <div className="hero-3d-poster" aria-hidden />,
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
  const [flowOk, setFlowOk] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const narrow = window.innerWidth < 800;
    const lowEnd =
      (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency != null &&
      (navigator.hardwareConcurrency as number) <= 4;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    // Mobile / low-end: keep static poster only — biggest TBT win
    if (reduce || narrow || lowEnd || saveData) {
      setFlowOk(false);
      return;
    }
    setFlowOk(true);
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      if (!cancelled) setShow3d(true);
    };
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(go, { timeout: 5000 });
    } else {
      timeoutId = setTimeout(go, 3200);
    }
    return () => {
      cancelled = true;
      if (idleId != null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [reduce]);

  return (
    <section className="hero-landing glass-hero">
      {flowOk ? <FlowField /> : null}
      <div className="hero-inner">
        <div className="hero-copy">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: 'drop-shadow(0 18px 40px rgba(255,79,32,0.28))', marginBottom: 12 }}
          >
            <LogoMark size={72} />
          </motion.div>
          <motion.p
            className="hero-kicker"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.45 }}
          >
            SoSoValue Wave 3 · FlowSentinel
          </motion.p>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            Watch the flow.
            <br />
            <span style={{ color: 'var(--accent-soft)' }}>Act with a gate.</span>
          </motion.h1>
          <motion.p
            className="hero-lede"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
          >
            A one-person fund desk: SoSoValue data becomes a daily thesis, a risk check you can read, and a
            confirmed SoDEX testnet order — with an honest public track record.
          </motion.p>
        </div>

        <div className="hero-visual">
          {/* Static poster for LCP; swapped for live r3f after idle */}
          {!show3d || reduce ? <div className="hero-3d-poster" aria-hidden /> : null}
          {show3d && !reduce ? <HeroScene reduceMotion={false} /> : null}
        </div>
      </div>

      <ol className="hero-steps">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.n}
            className="glass-card step-card"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.2 + Math.min(i * 0.05, 0.25),
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            }}
          >
            <div className="step-n">{s.n}</div>
            <div className="step-title">{s.title}</div>
            <div className="step-body">{s.body}</div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
