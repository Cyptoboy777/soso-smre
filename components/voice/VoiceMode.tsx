'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { DeskSnapshot } from '@/types/flow';
import { VOICE_LANGS, type VoiceLang, type VoiceIntent } from '@/lib/voice-answer';
import {
  ensureVoiceModels,
  speakText,
  getSpeechRecognition,
  openMicAnalyser,
  type VoiceEngineState,
  type LoadProgress,
  type TtsEngineId,
  type SpeechRec,
} from '@/lib/voice/engine';

const VoiceOrb = dynamic(() => import('./VoiceOrb').then((m) => m.VoiceOrb), {
  ssr: false,
  loading: () => <div className="voice-orb-fallback" aria-hidden />,
});

type Bubble = { id: string; role: 'user' | 'assistant'; text: string; engine?: string };

export function VoiceMode({
  open,
  onClose,
  desk,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  desk: DeskSnapshot;
  onRefresh: () => void;
}) {
  const reduce = useReducedMotion();
  const [lang, setLang] = useState<VoiceLang>('en-US');
  const [state, setState] = useState<VoiceEngineState>('idle');
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState('');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [ready, setReady] = useState(false);
  const [ttsEngine, setTtsEngine] = useState<TtsEngineId | null>(null);
  const [mounted, setMounted] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const micRef = useRef<Awaited<ReturnType<typeof openMicAnalyser>> | null>(null);
  const levelRaf = useRef(0);

  const speechLang = useMemo(() => {
    if (lang === 'auto') return 'en-US';
    return VOICE_LANGS.find((l) => l.id === lang)?.speech ?? 'en-US';
  }, [lang]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState('loading');
    setProgress({ phase: 'start', loaded: 0, total: 100, pct: 0 });
    void ensureVoiceModels((p) => {
      if (!cancelled) setProgress(p);
    })
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setState('idle');
          setProgress(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true); // still usable via Web Speech
          setState('idle');
          setProgress(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      try {
        recRef.current?.stop();
      } catch {
        /* */
      }
      micRef.current?.stop();
      cancelAnimationFrame(levelRaf.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [open, onClose]);

  const speak = useCallback(
    async (text: string) => {
      setState('speaking');
      try {
        const eng = await speakText({
          text,
          lang,
          speechLang,
          onProgress: setProgress,
          onLevel: setLevel,
        });
        setTtsEngine(eng);
      } finally {
        setLevel(0);
        setState('idle');
        setProgress(null);
      }
    },
    [lang, speechLang],
  );

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q) return;
      setBubbles((b) => [...b, { id: `u_${Date.now()}`, role: 'user', text: q }]);
      setState('thinking');
      setInterim('');
      try {
        const res = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, lang, desk }),
        });
        const json = (await res.json()) as {
          answer?: string;
          intent?: VoiceIntent;
          engine?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || 'Voice failed');
        if (json.intent === 'refresh') onRefresh();
        const answer = json.answer || 'No answer.';
        setBubbles((b) => [
          ...b,
          { id: `a_${Date.now()}`, role: 'assistant', text: answer, engine: json.engine },
        ]);
        await speak(answer);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setBubbles((b) => [...b, { id: `e_${Date.now()}`, role: 'assistant', text: msg }]);
        setState('idle');
      }
    },
    [desk, lang, onRefresh, speak],
  );

  const stopListen = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* */
    }
    micRef.current?.stop();
    micRef.current = null;
    cancelAnimationFrame(levelRaf.current);
    setLevel(0);
    setState('idle');
  };

  const toggleListen = async () => {
    if (state === 'listening') {
      stopListen();
      return;
    }
    if (state === 'speaking' || state === 'thinking' || state === 'loading') return;

    const Ctor = getSpeechRecognition();
    // Mic level always (orb)
    try {
      micRef.current = await openMicAnalyser();
      const tick = () => {
        setLevel(micRef.current?.getLevel() ?? 0);
        levelRaf.current = requestAnimationFrame(tick);
      };
      levelRaf.current = requestAnimationFrame(tick);
    } catch {
      /* mic denied — Web Speech may still work */
    }

    if (!Ctor) {
      setBubbles((b) => [
        ...b,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          text: 'Speech recognition unavailable in this browser. Type below, or try Chrome/Edge. Whisper model may still help on a later pass.',
        },
      ]);
      stopListen();
      return;
    }

    const rec = new Ctor();
    rec.lang = speechLang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let finalText = '';
      let inter = '';
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        if (row.isFinal) finalText += row[0].transcript;
        else inter += row[0].transcript;
      }
      setInterim(inter);
      if (finalText.trim()) {
        setInterim('');
        stopListen();
        void ask(finalText.trim());
      }
    };
    rec.onerror = () => stopListen();
    rec.onend = () => {
      micRef.current?.stop();
      micRef.current = null;
      cancelAnimationFrame(levelRaf.current);
      setLevel(0);
      setState('idle');
    };
    recRef.current = rec;
    try {
      rec.start();
      setState('listening');
    } catch {
      stopListen();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="voice-mode-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="FlowSentinel voice mode"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <button type="button" className="voice-mode-close" onClick={onClose} aria-label="Close voice mode">
            ✕
          </button>

          <div className="voice-mode-stage">
            <div className="voice-mode-orb-wrap">
              <VoiceOrb level={level} state={state} reduceMotion={Boolean(reduce)} />
            </div>

            <p className="voice-mode-state" aria-live="polite">
              {state === 'loading' && 'Loading free local models…'}
              {state === 'idle' && (ready ? 'Tap the mic · voice never places orders' : 'Preparing…')}
              {state === 'listening' && 'Listening…'}
              {state === 'thinking' && 'Thinking…'}
              {state === 'speaking' && `Speaking${ttsEngine ? ` · ${ttsEngine}` : ''}`}
            </p>

            {progress && (
              <div className="voice-progress" role="status">
                <div className="voice-progress-bar">
                  <div style={{ width: `${progress.pct}%` }} />
                </div>
                <span>
                  {progress.phase} · {progress.pct}%
                </span>
              </div>
            )}

            <div className="voice-mode-transcript" aria-live="polite">
              {interim && <div className="voice-interim">{interim}…</div>}
              {bubbles.slice(-4).map((b) => (
                <div key={b.id} className={`voice-bubble voice-bubble-${b.role}`}>
                  {b.text}
                </div>
              ))}
            </div>

            <div className="voice-mode-langs" role="group" aria-label="Language">
              {VOICE_LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="lang-chip"
                  data-active={lang === l.id ? 'true' : 'false'}
                  onClick={() => setLang(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <div className="voice-mode-controls">
              <button
                type="button"
                className="btn btn-primary voice-mic"
                aria-pressed={state === 'listening'}
                aria-label={state === 'listening' ? 'Stop listening' : 'Start listening'}
                disabled={state === 'loading' || state === 'thinking' || state === 'speaking'}
                onClick={() => void toggleListen()}
              >
                {state === 'listening' ? '■' : '🎤'}
              </button>
              <button type="button" className="btn" onClick={() => void ask('read thesis')} disabled={state !== 'idle'}>
                Read thesis
              </button>
              <button type="button" className="btn" onClick={() => void ask('explain risk')} disabled={state !== 'idle'}>
                Explain risk
              </button>
            </div>

            <form
              className="voice-mode-type"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const q = String(fd.get('q') || '');
                e.currentTarget.reset();
                stopListen();
                void ask(q);
              }}
            >
              <input name="q" placeholder="Type if mic unavailable…" autoComplete="off" aria-label="Type a question" />
              <button type="submit" className="btn" disabled={state === 'thinking' || state === 'speaking'}>
                Ask
              </button>
            </form>

            <p className="voice-mode-disclaimer">
              Not financial advice · SoDEX testnet only · Kokoro / Piper / Whisper run locally when available · Web
              Speech fallback · never places orders by voice
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
