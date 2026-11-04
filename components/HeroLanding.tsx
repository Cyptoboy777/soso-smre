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
  { n: '01', title: 'Watch markets', body: 'ETF flows and news from SoSoValue' },
  { n: '02', title: 'Get an idea', body: 'Clear direction with confidence' },
  { n: '03', title: 'Check risk', body: 'Size and safety checks you can read' },
  { n: '04', title: 'You confirm', body: 'Practice orders only when you say yes' },
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
            <LogoMark size={72} animated />
          </motion.div>
          <motion.p
            className="hero-kicker"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.45 }}
          >
            Built for SoSoValue traders
          </motion.p>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            Smarter crypto moves
            <br />
            <span style={{ color: 'var(--accent-soft)' }}>from real market news.</span>
          </motion.h1>
          <motion.p
            className="hero-lede"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
          >
            FlowSentinel turns SoSoValue flows into a clear idea, a simple risk check, and a practice trade
            you confirm yourself.
          </motion.p>
          <motion.div
            className="hero-cta-row"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.45 }}
          >
            <a className="btn btn-primary" href="#desk">
              Open the desk
            </a>
            <a className="btn btn-ghost" href="/start">
              Get started
            </a>
            <a className="btn btn-ghost" href="/track-record">
              See results
            </a>
          </motion.div>
          <motion.ul
            className="hero-proof-strip"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.32, duration: 0.5 }}
          >
            <li>
              <span className="proof-k">Mode</span>
              <span className="proof-v">Practice by default</span>
            </li>
            <li>
              <span className="proof-k">Data</span>
              <span className="proof-v">Powered by SoSoValue</span>
            </li>
            <li>
              <span className="proof-k">Trading</span>
              <span className="proof-v">You confirm every order</span>
            </li>
            <li>
              <span className="proof-k">Proof</span>
              <span className="proof-v">Public track record</span>
            </li>
          </motion.ul>
        </div>

        <div className="hero-visual">
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
