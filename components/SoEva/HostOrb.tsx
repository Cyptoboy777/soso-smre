'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { type Emotion, EMOTION_CFG } from './types';

interface Props {
  isSpeaking: boolean;
  emotion: Emotion;
  label: string;
  tag: string;
  side: 'left' | 'right';
  size?: number;
}

/**
 * HostOrb — Animated pulsing orb with waveform visualizer for SoEva hosts.
 * Shows voice activity via animated bars and glowing rings.
 */
export default function HostOrb({ isSpeaking, emotion, label, tag, side, size = 90 }: Props) {
  const cfg = EMOTION_CFG[emotion];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!isSpeaking) return;
    const id = setInterval(() => setFrame((n) => n + 1), 80);
    return () => clearInterval(id);
  }, [isSpeaking]);

  const bars = 14;
  const barHeights = Array.from({ length: bars }, (_, i) =>
    isSpeaking ? 5 + Math.abs(Math.sin(frame * 0.45 + i * 0.7)) * 28 : 3,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: size + 30 }}>
      {/* Orb */}
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* Glow rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale:   isSpeaking ? [1, 2.0 + i * 0.35, 1] : [1, 1.25, 1],
              opacity: [0.35, 0, 0.35],
            }}
            transition={{ repeat: Infinity, duration: isSpeaking ? 0.85 : 2.4, delay: i * 0.25 }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `1px solid ${cfg.color}`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Core orb */}
        <motion.div
          animate={{
            scale:     isSpeaking ? [1, 1.06, 1] : [1, 1.02, 1],
            boxShadow: isSpeaking
              ? [`0 0 20px ${cfg.glow}, 0 0 60px ${cfg.glow}`, `0 0 35px ${cfg.glow}, 0 0 90px ${cfg.glow}`, `0 0 20px ${cfg.glow}`]
              : [`0 0 12px ${cfg.glow}40`],
          }}
          transition={{ repeat: Infinity, duration: isSpeaking ? 0.7 : 3 }}
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${cfg.color}cc, ${cfg.color}22 60%, #05050f)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: size * 0.28, lineHeight: 1 }}>{cfg.emoji}</span>
        </motion.div>
      </div>

      {/* Waveform bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 36 }}>
        {barHeights.map((h, i) => (
          <motion.div
            key={i}
            animate={{ height: h }}
            transition={{ duration: 0.06, ease: 'linear' }}
            style={{
              width: 2.5,
              borderRadius: 2,
              background: isSpeaking
                ? `linear-gradient(180deg, ${cfg.color}, ${cfg.color}44)`
                : '#2a2a4a',
            }}
          />
        ))}
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: cfg.color, letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.1em', marginTop: 2 }}>
          {side === 'left' ? `◀ ${tag}` : `${tag} ▶`}
        </div>
      </div>
    </div>
  );
}
