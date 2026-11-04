'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';

const AiOrb = dynamic(() => import('./AiOrb').then((m) => m.AiOrb), { ssr: false });

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'How do I start?',
  'What is practice mode?',
  'Explain the app fee',
];

const GREETING =
  "Hi, I'm your FlowSentinel guide. Ask about the desk, practice trades, or SoSoValue news. I never place orders.";

export function AiChatDock() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }, [messages, open, reduce]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: messages.slice(-6),
        }),
      });
      const json = (await res.json()) as { reply?: string; error?: string; suggestions?: string[] };
      if (!res.ok) throw new Error(json.error ?? 'Assistant unavailable');
      setMessages((m) => [...m, { role: 'assistant', content: json.reply ?? 'Try asking how to start.' }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: e instanceof Error ? e.message : 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="backdrop"
            className="ai-backdrop"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
        ) : null}
      </AnimatePresence>

      <div className="ai-dock">
        <AnimatePresence>
          {open ? (
            <motion.aside
              key="panel"
              className="ai-panel"
              initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Assistant chat"
              role="dialog"
              aria-modal="true"
            >
              <header className="ai-panel-head">
                <div className="ai-panel-title">
                  <AiOrb size={32} active={!busy} />
                  <div>
                    <strong>Assistant</strong>
                    <span>Never places orders</span>
                  </div>
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Close
                </button>
              </header>
              <div className="ai-messages" role="log" aria-live="polite">
                {messages.map((m, i) => (
                  <div key={`${m.role}-${i}`} className={`ai-bubble ai-bubble-${m.role}`}>
                    {m.content}
                  </div>
                ))}
                {busy ? <div className="ai-bubble ai-bubble-assistant ai-typing">Thinking…</div> : null}
                <div ref={endRef} />
              </div>
              <div className="ai-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="ai-chip" onClick={() => void send(s)} disabled={busy}>
                    {s}
                  </button>
                ))}
              </div>
              <form
                className="ai-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about the desk…"
                  aria-label="Message"
                  maxLength={1200}
                />
                <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
                  Send
                </button>
              </form>
            </motion.aside>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          className="ai-launcher"
          aria-label={open ? 'Close assistant' : 'Open assistant'}
          onClick={() => setOpen((v) => !v)}
          whileTap={reduce ? undefined : { scale: 0.96 }}
        >
          <AiOrb size={68} active={open || busy} />
        </motion.button>
      </div>
    </>
  );
}
