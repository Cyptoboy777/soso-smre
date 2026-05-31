'use client';

import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import { EMOTION_CFG } from './types';
import { useEvaState } from './useEvaState';
import HostOrb from './HostOrb';
import ScriptPanel from './ScriptPanel';
import PlayerControls from './PlayerControls';

/**
 * SoEva — AI Dual-Host Podcast Studio
 * Produces live market commentary with two animated AI hosts: EVA + ECHO
 */
export default function SoEva() {
  const {
    playing, lineIndex, emotion, muted, speakingHost,
    topic, topics, script, isGenerating, error,
    setTopic, setEmotion, toggleMute, generateScript, play, stop, skipLine,
  } = useEvaState();

  const cfg = EMOTION_CFG[emotion];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', minHeight: 520,
        background: 'linear-gradient(160deg, #05050f 0%, #08081a 60%, #060612 100%)',
        border: `1px solid ${cfg.color}20`,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: `0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px ${cfg.color}08`,
      }}
    >
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: `1px solid ${cfg.color}15`,
        background: 'rgba(0,0,0,0.4)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <motion.div
            animate={{ opacity: playing ? [1, 0.3, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <Radio size={16} color={cfg.color} />
          </motion.div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
              SoEva Studio
            </div>
            <div style={{ fontSize: 9, color: cfg.color, fontWeight: 700, letterSpacing: '0.12em' }}>
              {cfg.emoji} {cfg.label} MODE · AI DUAL-HOST BROADCAST
            </div>
          </div>
          {playing && (
            <motion.div
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e' }} />
              <span style={{ fontSize: 9, fontWeight: 900, color: '#f43f5e', letterSpacing: '0.1em' }}>ON AIR</span>
            </motion.div>
          )}
        </div>

        {/* Topic selector */}
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${cfg.color}25`, borderRadius: 10,
            padding: '8px 12px', color: '#fff', fontSize: 12,
            outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {topics.map((t) => <option key={t} value={t} style={{ background: '#0d0d1a' }}>{t}</option>)}
        </select>

        {error && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', fontSize: 11, color: '#f43f5e' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* ── HOSTS ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '20px 24px', borderBottom: `1px solid ${cfg.color}10`,
        background: 'rgba(0,0,0,0.2)', flexShrink: 0,
      }}>
        <HostOrb
          isSpeaking={playing && speakingHost === 'eva'}
          emotion={emotion}
          label="EVA"
          tag="Analyst"
          side="left"
          size={80}
        />

        {/* Center divider */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 1, height: 40, background: `linear-gradient(180deg, transparent, ${cfg.color}30, transparent)` }} />
          <span style={{ fontSize: 10, fontWeight: 900, color: cfg.color, letterSpacing: '0.08em', opacity: 0.6 }}>VS</span>
          <div style={{ width: 1, height: 40, background: `linear-gradient(180deg, transparent, ${cfg.color}30, transparent)` }} />
        </div>

        <HostOrb
          isSpeaking={playing && speakingHost === 'echo'}
          emotion={emotion}
          label="ECHO"
          tag="Strategist"
          side="right"
          size={80}
        />
      </div>

      {/* ── SCRIPT PANEL ──────────────────────────────────────────── */}
      <ScriptPanel
        script={script}
        lineIndex={lineIndex}
        speakingHost={speakingHost}
        emotion={emotion}
        isGenerating={isGenerating}
      />

      {/* ── CONTROLS ──────────────────────────────────────────────── */}
      <PlayerControls
        playing={playing}
        muted={muted}
        emotion={emotion}
        lineIndex={lineIndex}
        totalLines={script.length}
        isGenerating={isGenerating}
        hasScript={script.length > 0}
        onPlay={play}
        onStop={stop}
        onSkip={skipLine}
        onToggleMute={toggleMute}
        onSetEmotion={setEmotion}
        onGenerate={generateScript}
      />
    </motion.div>
  );
}
