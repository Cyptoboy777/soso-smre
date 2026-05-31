'use client';

import { motion } from 'framer-motion';
import { Play, Square, SkipForward, Volume2, VolumeX, RefreshCw, Zap } from 'lucide-react';
import { type Emotion, EMOTION_CFG } from './types';

interface Props {
  playing: boolean;
  muted: boolean;
  emotion: Emotion;
  lineIndex: number;
  totalLines: number;
  isGenerating: boolean;
  hasScript: boolean;
  onPlay: () => void;
  onStop: () => void;
  onSkip: () => void;
  onToggleMute: () => void;
  onSetEmotion: (e: Emotion) => void;
  onGenerate: () => void;
}

const EMOTION_KEYS = ['divine', 'joy', 'alert', 'serious'] as const;

/**
 * PlayerControls — Transport bar + emotion selector for SoEva podcast studio.
 */
export default function PlayerControls({
  playing, muted, emotion, lineIndex, totalLines,
  isGenerating, hasScript,
  onPlay, onStop, onSkip, onToggleMute, onSetEmotion, onGenerate,
}: Props) {
  const cfg = EMOTION_CFG[emotion];
  const progress = totalLines > 0 ? (lineIndex / totalLines) * 100 : 0;

  return (
    <div style={{ padding: '14px 16px', borderTop: '1px solid #1e1e3a', display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
      {/* Progress bar */}
      {hasScript && (
        <div style={{ height: 2, background: '#1e1e3a', borderRadius: 2, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ height: '100%', background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)` }}
          />
        </div>
      )}

      {/* Transport buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Play / Stop */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={playing ? onStop : onPlay}
          disabled={!hasScript || isGenerating}
          style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}88)`,
            color: '#000', cursor: hasScript ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: hasScript ? 1 : 0.4,
            boxShadow: playing ? `0 0 20px ${cfg.glow}` : 'none',
            transition: 'box-shadow 0.3s',
          }}
        >
          {playing ? <Square size={14} /> : <Play size={14} />}
        </motion.button>

        {/* Skip */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onSkip}
          disabled={!playing}
          style={{
            width: 32, height: 32, borderRadius: '50%', border: '1px solid #1e1e3a',
            background: 'transparent', color: playing ? '#888' : '#333',
            cursor: playing ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <SkipForward size={13} />
        </motion.button>

        {/* Mute */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onToggleMute}
          style={{
            width: 32, height: 32, borderRadius: '50%', border: `1px solid ${muted ? '#333' : '#1e1e3a'}`,
            background: 'transparent', color: muted ? '#444' : '#888',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </motion.button>

        {/* Progress text */}
        {hasScript && (
          <span style={{ fontSize: 10, color: '#444', fontFamily: 'monospace', marginLeft: 4 }}>
            {lineIndex + 1} / {totalLines}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Generate / Regenerate */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onGenerate}
          disabled={isGenerating}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 10,
            border: `1px solid ${cfg.color}40`,
            background: `${cfg.color}12`,
            color: cfg.color, fontSize: 11, fontWeight: 800,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            opacity: isGenerating ? 0.6 : 1,
            letterSpacing: '0.06em',
          }}
        >
          {isGenerating
            ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
            : <><Zap size={11} /> {hasScript ? 'Regenerate' : 'Generate Script'}</>
          }
        </motion.button>
      </div>

      {/* Emotion selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ fontSize: 9, color: '#333', fontWeight: 800, letterSpacing: '0.1em', alignSelf: 'center', minWidth: 50 }}>MOOD</span>
        {EMOTION_KEYS.map((e) => {
          const ec = EMOTION_CFG[e];
          const active = emotion === e;
          return (
            <button
              key={e}
              onClick={() => onSetEmotion(e)}
              title={ec.desc}
              style={{
                flex: 1, padding: '5px 4px', borderRadius: 8,
                border: `1px solid ${active ? ec.color + '60' : '#1e1e3a'}`,
                background: active ? `${ec.color}15` : 'transparent',
                color: active ? ec.color : '#444',
                fontSize: 9, fontWeight: 900, cursor: 'pointer',
                letterSpacing: '0.06em', transition: 'all 0.15s',
              }}
            >
              {ec.emoji} {ec.label}
            </button>
          );
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
