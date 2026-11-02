'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { DeskSnapshot } from '@/types/flow';
import { VOICE_LANGS } from '@/lib/voice-answer';

const VoiceMode = dynamic(() => import('./voice/VoiceMode').then((m) => m.VoiceMode), {
  ssr: false,
});

export function VoiceAssistant({
  desk,
  onRefresh,
}: {
  desk: DeskSnapshot;
  onRefresh: () => void;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  return (
    <section className="panel panel-interactive" aria-label="Voice assistant">
      <div className="panel-head">
        <div>
          <strong style={{ fontWeight: 560 }}>Voice desk</strong>
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            Grok-style orb · Kokoro / Piper / Whisper · never orders by voice
          </span>
        </div>
      </div>
      <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
        <div className="empty-state">
          <strong>Open full-screen voice mode</strong>
          <span>
            Animated 3D orb reacts to your mic and speech. Natural TTS via Kokoro-82M (English) and Piper
            (Hindi and Romance languages), Whisper STT in-browser, Web Speech as fallback. Languages:{' '}
            {VOICE_LANGS.filter((l) => l.id !== 'auto')
              .map((l) => l.label)
              .join(', ')}.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <motion.button
            type="button"
            className="btn btn-primary"
            onClick={() => setOpen(true)}
            whileTap={reduce ? undefined : { scale: 0.98 }}
            style={{ minHeight: 48, paddingInline: 22 }}
          >
            Enter voice mode
          </motion.button>
          <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-faint)' }}>
            Models download once and cache locally · free open-source only
          </span>
        </div>
      </div>
      <VoiceMode open={open} onClose={() => setOpen(false)} desk={desk} onRefresh={onRefresh} />
    </section>
  );
}
