'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { type ScriptLine, type Emotion, EMOTION_CFG } from './types';

interface Props {
  script: ScriptLine[];
  lineIndex: number;
  speakingHost: 'eva' | 'echo' | null;
  emotion: Emotion;
  isGenerating: boolean;
}

const HOST_COLORS = {
  eva:  '#a78bfa',
  echo: '#38bdf8',
};

/**
 * ScriptPanel — Shows the current script with highlighted active speaker line.
 * Scrolls automatically as the AI reads through the script.
 */
export default function ScriptPanel({ script, lineIndex, speakingHost, emotion, isGenerating }: Props) {
  const cfg = EMOTION_CFG[emotion];

  if (isGenerating) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
          style={{ width: 36, height: 36, border: `2px solid ${cfg.color}22`, borderTopColor: cfg.color, borderRadius: '50%' }}
        />
        <span style={{ fontSize: 12, color: cfg.color, fontFamily: 'monospace', letterSpacing: '0.1em', fontWeight: 700 }}>
          Generating script…
        </span>
      </div>
    );
  }

  if (script.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, opacity: 0.4 }}>
        <Zap size={28} color={cfg.color} />
        <span style={{ fontSize: 12, color: '#666', textAlign: 'center', lineHeight: 1.6 }}>
          Select a topic above and hit<br /><strong style={{ color: cfg.color }}>Generate Script</strong> to start
        </span>
      </div>
    );
  }

  return (
    <div className="scroll-track" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence initial={false}>
        {script.map((line, i) => {
          const isActive = i === lineIndex;
          const isPast   = i < lineIndex;
          const hostColor = HOST_COLORS[line.host];

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: isPast ? 0.35 : 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex', gap: 10, padding: '8px 10px',
                borderRadius: 10, transition: 'all 0.25s',
                background: isActive ? `${hostColor}10` : 'transparent',
                border: `1px solid ${isActive ? `${hostColor}30` : 'transparent'}`,
                boxShadow: isActive ? `0 0 20px ${hostColor}10` : 'none',
              }}
            >
              {/* Speaker tag */}
              <div style={{
                flexShrink: 0, width: 38, height: 38, borderRadius: '50%',
                background: `${hostColor}18`, border: `1px solid ${hostColor}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 900, color: hostColor, letterSpacing: '0.06em',
              }}>
                {line.host === 'eva' ? 'EVA' : 'ECHO'}
              </div>

              {/* Text */}
              <div style={{ flex: 1, alignSelf: 'center' }}>
                {isActive && speakingHost === line.host ? (
                  <motion.p
                    animate={{ opacity: [1, 0.6, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    style={{ fontSize: 12, color: '#dde', lineHeight: 1.6, margin: 0, fontFamily: 'monospace' }}
                  >
                    {line.text}
                  </motion.p>
                ) : (
                  <p style={{ fontSize: 12, color: isPast ? '#444' : '#aab', lineHeight: 1.6, margin: 0, fontFamily: 'monospace' }}>
                    {line.text}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
