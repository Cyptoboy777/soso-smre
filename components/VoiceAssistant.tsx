'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { DeskSnapshot } from '@/types/flow';
import { VOICE_LANGS, type VoiceLang, type VoiceIntent } from '@/lib/voice-answer';

type Bubble = { id: string; role: 'user' | 'assistant'; text: string; engine?: string };

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceAssistant({
  desk,
  onRefresh,
}: {
  desk: DeskSnapshot;
  onRefresh: () => void;
}) {
  const reduce = useReducedMotion();
  const [lang, setLang] = useState<VoiceLang>('en-US');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRec | null>(null);
  const animRef = useRef(0);

  const speechLang = useMemo(() => {
    if (lang === 'auto') return 'en-US';
    return VOICE_LANGS.find((l) => l.id === lang)?.speech ?? 'en-US';
  }, [lang]);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang;
      u.rate = 1.02;
      window.speechSynthesis.speak(u);
    },
    [speechLang],
  );

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q) return;
      setBubbles((b) => [...b, { id: `u_${Date.now()}`, role: 'user', text: q }]);
      setBusy(true);
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
        const answer = json.answer || 'No answer.';
        if (json.intent === 'refresh') onRefresh();
        setBubbles((b) => [
          ...b,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            text: answer,
            engine: json.engine,
          },
        ]);
        speak(answer);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setBubbles((b) => [...b, { id: `e_${Date.now()}`, role: 'assistant', text: msg }]);
      } finally {
        setBusy(false);
      }
    },
    [desk, lang, onRefresh, speak],
  );

  const stopWave = () => {
    cancelAnimationFrame(animRef.current);
    setLevel(0);
  };

  const startWave = () => {
    if (reduce) return;
    const tick = () => {
      setLevel(0.25 + Math.random() * 0.75);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const toggleListen = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    if (listening && recRef.current) {
      recRef.current.stop();
      setListening(false);
      stopWave();
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
        void ask(finalText.trim());
      }
    };
    rec.onerror = () => {
      setListening(false);
      stopWave();
    };
    rec.onend = () => {
      setListening(false);
      stopWave();
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      startWave();
    } catch {
      setListening(false);
      stopWave();
    }
  };

  const readThesis = () => {
    void ask('read thesis');
  };

  return (
    <section className="panel" aria-label="Voice assistant">
      <div className="panel-head">
        <div>
          <strong style={{ fontWeight: 560 }}>Voice desk</strong>
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            Free Web Speech · never orders by voice
          </span>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Language</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as VoiceLang)}
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '8px 10px',
              fontSize: 14,
              minHeight: 40,
            }}
          >
            {VOICE_LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
        {!supported && (
          <div className="empty-state">
            <strong>Speech recognition unavailable</strong>
            <span>
              This browser has no Web Speech API. Type a question below, or open Chrome/Edge. Optional
              in-browser Whisper (transformers.js) can be added later as a heavier fallback.
            </span>
          </div>
        )}

        <div
          style={{
            minHeight: 120,
            maxHeight: 220,
            overflowY: 'auto',
            display: 'grid',
            gap: 8,
            padding: 4,
          }}
          aria-live="polite"
        >
          {bubbles.length === 0 && (
            <div className="empty-state">
              <strong>Ask about today&apos;s desk</strong>
              <span>
                Push the mic and say “read thesis”, “explain risk”, “ETF flows”, “news”, or “refresh
                thesis”. Works in judge mode without keys.
              </span>
            </div>
          )}
          {bubbles.map((b) => (
            <motion.div
              key={b.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                justifySelf: b.role === 'user' ? 'end' : 'start',
                maxWidth: '85%',
                padding: '10px 12px',
                borderRadius: b.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: b.role === 'user' ? 'rgba(255,79,32,0.18)' : 'var(--surface-2)',
                border: '1px solid var(--line)',
                fontSize: 14,
                lineHeight: 1.45,
              }}
            >
              {b.text}
              {b.engine && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-faint)' }}>{b.engine}</div>
              )}
            </motion.div>
          ))}
          {interim && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>{interim}…</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            aria-pressed={listening}
            aria-label={listening ? 'Stop listening' : 'Push to talk'}
            onClick={toggleListen}
            disabled={busy || !supported}
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              padding: 0,
              boxShadow: listening ? '0 0 0 6px rgba(255,79,32,0.2)' : undefined,
            }}
          >
            {listening ? '■' : '🎤'}
          </button>

          <div
            aria-hidden
            style={{ display: 'flex', alignItems: 'end', gap: 3, height: 36, width: 88 }}
          >
            {Array.from({ length: 9 }).map((_, i) => {
              const h = listening
                ? 6 + ((level * (0.4 + (i % 5) * 0.15)) % 1) * 30
                : 6;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    borderRadius: 2,
                    background: listening ? 'var(--accent)' : 'var(--surface-3)',
                    transition: reduce ? undefined : 'height 80ms linear',
                  }}
                />
              );
            })}
          </div>

          <button type="button" className="btn" onClick={readThesis} disabled={busy}>
            Read thesis aloud
          </button>
          <button type="button" className="btn" onClick={() => void ask('explain risk')} disabled={busy}>
            Explain risk
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const q = String(fd.get('q') || '');
            e.currentTarget.reset();
            void ask(q);
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            name="q"
            placeholder="Type a question if mic is unavailable…"
            autoComplete="off"
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              padding: '0 14px',
              fontSize: 15,
            }}
          />
          <button type="submit" className="btn" disabled={busy}>
            Ask
          </button>
        </form>
      </div>
    </section>
  );
}
