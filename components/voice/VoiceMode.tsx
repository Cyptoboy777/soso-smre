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
  friendlyVoiceMessage,
  getVoiceCapabilities,
  transcribeWhisper,
  type VoiceEngineState,
  type LoadProgress,
  type TtsEngineId,
  type SpeechRec,
} from '@/lib/voice/engine';
import {
  createContinuousVad,
  createEnergyVadFallback,
  type ContinuousSession,
} from '@/lib/voice/continuous';

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
  const [continuous, setContinuous] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  const recRef = useRef<SpeechRec | null>(null);
  const micRef = useRef<Awaited<ReturnType<typeof openMicAnalyser>> | null>(null);
  const levelRaf = useRef(0);
  const continuousRef = useRef<ContinuousSession | null>(null);
  const bargeRef = useRef(false);
  const mutedRef = useRef(false);
  const askRef = useRef<(q: string) => Promise<void>>(async () => {});

  const speechLang = useMemo(() => {
    if (lang === 'auto') return 'en-US';
    return VOICE_LANGS.find((l) => l.id === lang)?.speech ?? 'en-US';
  }, [lang]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState('loading');
    setProgress({ phase: 'start', loaded: 0, total: 100, pct: 0, label: 'Preparing voice…' });
    void ensureVoiceModels((p) => {
      if (!cancelled) setProgress(p);
    })
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setState('idle');
          setProgress(null);
          const caps = getVoiceCapabilities();
          if (caps.tts === 'none' && caps.stt === 'none') {
            setBubbles((b) => [
              ...b,
              {
                id: `n_${Date.now()}`,
                role: 'assistant',
                text: 'Voice models are unavailable here. You can still type questions. Voice never places orders.',
              },
            ]);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setReady(true);
          setState('idle');
          setProgress(null);
          setBubbles((b) => [
            ...b,
            { id: `n_${Date.now()}`, role: 'assistant', text: friendlyVoiceMessage(e) },
          ]);
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
      continuousRef.current?.destroy();
      continuousRef.current = null;
    };
  }, [open, onClose]);

  const speak = useCallback(
    async (text: string) => {
      setState('speaking');
      bargeRef.current = false;
      // Pause VAD while speaking to avoid self-echo, unless barge-in starts
      continuousRef.current?.pause();
      try {
        const eng = await speakText({
          text,
          lang,
          speechLang,
          onProgress: (p) => setProgress(p.pct < 100 ? p : null),
          onLevel: setLevel,
        });
        if (eng) setTtsEngine(eng);
      } catch (e) {
        console.warn('[voice] speak failed', e);
      } finally {
        setLevel(0);
        setProgress(null);
        if (!bargeRef.current && continuousRef.current && !mutedRef.current) {
          continuousRef.current.resume();
          setState('listening');
        } else {
          setState('idle');
        }
      }
    },
    [lang, speechLang, muted],
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
        setBubbles((b) => [
          ...b,
          { id: `e_${Date.now()}`, role: 'assistant', text: friendlyVoiceMessage(e) },
        ]);
        setState('idle');
      }
    },
    [desk, lang, onRefresh, speak],
  );

  useEffect(() => {
    askRef.current = ask;
  }, [ask]);

  const stopContinuous = useCallback(() => {
    continuousRef.current?.destroy();
    continuousRef.current = null;
    setContinuous(false);
  }, []);

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
    if (!continuousRef.current) setState('idle');
  };

  const startContinuous = async () => {
    if (continuousRef.current) {
      stopContinuous();
      stopListen();
      setState('idle');
      return;
    }
    setMuted(false);
    const onSpeechEnd = async (pcm: Float32Array) => {
      if (mutedRef.current) return;
      // Barge-in: if speaking, cut TTS and take the new utterance
      if (state === 'speaking' || bargeRef.current) {
        bargeRef.current = true;
        try {
          window.speechSynthesis?.cancel();
        } catch {
          /* */
        }
      }
      setState('thinking');
      continuousRef.current?.pause();
      try {
        let text = '';
        try {
          const caps = getVoiceCapabilities();
          if (caps.stt === 'whisper') {
            const out = await transcribeWhisper(pcm);
            text = out.text;
          }
        } catch (e) {
          console.warn('[voice] whisper continuous failed', e);
        }
        if (!text.trim()) {
          // soft fail — resume listening without raw errors
          continuousRef.current?.resume();
          setState('listening');
          return;
        }
        await askRef.current(text.trim());
      } catch (e) {
        setBubbles((b) => [
          ...b,
          { id: `e_${Date.now()}`, role: 'assistant', text: friendlyVoiceMessage(e) },
        ]);
        continuousRef.current?.resume();
        setState('listening');
      }
    };

    let session = await createContinuousVad({
      onSpeechStart: () => {
        if (state === 'speaking') {
          bargeRef.current = true;
          try {
            window.speechSynthesis?.cancel();
          } catch {
            /* */
          }
        }
        setState('listening');
      },
      onSpeechEnd,
      onLevel: setLevel,
      onError: (e) => console.warn('[voice] vad', e),
    });
    if (!session) {
      session = await createEnergyVadFallback({
        onSpeechStart: () => setState('listening'),
        onSpeechEnd,
        onLevel: setLevel,
      });
    }
    if (!session) {
      setBubbles((b) => [
        ...b,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          text: 'Continuous mic is unavailable here. Tap push-to-talk, or type. Voice never places orders.',
        },
      ]);
      return;
    }
    continuousRef.current = session;
    setContinuous(true);
    session.start();
    setState('listening');
    setBubbles((b) => [
      ...b,
      {
        id: `n_${Date.now()}`,
        role: 'assistant',
        text: 'Continuous conversation on. I will listen, answer, and keep listening. Say stop or hit Mute to pause. Voice never places orders.',
      },
    ]);
  };

  const toggleListen = async () => {
    if (continuous) {
      await startContinuous(); // toggles off
      return;
    }
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
          text: 'Live listening is limited here. Type a question below — answers still work, and voice never places orders.',
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
              {state === 'idle' &&
                (ready
                  ? continuous
                    ? 'Continuous mode paused · voice never places orders'
                    : 'Start continuous talk · voice never places orders'
                  : 'Preparing…')}
              {state === 'listening' && (continuous ? 'Listening continuously…' : 'Listening…')}
              {state === 'thinking' && 'Thinking…'}
              {state === 'speaking' && `Speaking${ttsEngine ? ` · ${ttsEngine}` : ''}`}
            </p>

            {progress && progress.pct < 100 && (
              <div className="voice-progress" role="status">
                <div className="voice-progress-bar">
                  <div style={{ width: `${Math.max(12, Math.min(progress.pct, 96))}%` }} />
                </div>
                <span>
                  {progress.pct < 8
                    ? 'Preparing voice models…'
                    : `${(progress.label || 'Loading…').replace(/Downloading (Whisper|Kokoro).*/, 'Preparing voice…')} · ${Math.max(progress.pct, 1)}%`}
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
                aria-pressed={continuous || state === 'listening'}
                aria-label={continuous ? 'Stop continuous conversation' : 'Start continuous conversation'}
                disabled={state === 'loading'}
                onClick={() => void startContinuous()}
              >
                {continuous ? '● Live' : 'Talk'}
              </button>
              <button
                type="button"
                className="btn"
                aria-pressed={muted}
                disabled={!continuous}
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  if (next) {
                    continuousRef.current?.pause();
                    try {
                      window.speechSynthesis?.cancel();
                    } catch {
                      /* */
                    }
                    setState('idle');
                  } else {
                    continuousRef.current?.resume();
                    setState('listening');
                  }
                }}
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  bargeRef.current = true;
                  try {
                    window.speechSynthesis?.cancel();
                  } catch {
                    /* */
                  }
                  void ask('read thesis');
                }}
                disabled={state === 'loading' || state === 'thinking'}
              >
                Read thesis
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void ask('explain risk')}
                disabled={state === 'loading' || state === 'thinking'}
              >
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
              Not financial advice · SoDEX testnet only · Continuous VAD (Silero) + Whisper/Kokoro when available ·
              barge-in supported · never places orders by voice
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
