'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import { sanitizeAssistantReply } from '@/lib/chat-reply';
import { formatPair, formatSideLabel, sanitizePublicText } from '@/lib/display';

const AiOrb = dynamic(() => import('./AiOrb').then((m) => m.AiOrb), { ssr: false });

type Msg = { role: 'user' | 'assistant'; content: string };

type DeskContext = {
  btcPrice?: number | null;
  ethPrice?: number | null;
  solPrice?: number | null;
  btcEtfFlow?: number | null;
  ethEtfFlow?: number | null;
  ideaSide?: string | null;
  ideaSymbol?: string | null;
  ideaSummary?: string | null;
};

const SUGGESTIONS = [
  'What is today\'s BTC price?',
  'Explain today\'s idea simply',
  'How do I review an order?',
];

const GREETING =
  "Hi, I'm your FlowSentinel guide. Ask about live prices or today's idea. I never place orders.";

async function readDeskContext(): Promise<DeskContext> {
  try {
    const [desk, tickers] = await Promise.all([
      fetch('/api/thesis', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/sodex/market?list=tickers', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const list = (tickers?.tickers ?? []) as Array<{ symbol: string; lastPrice: number }>;
    const find = (re: RegExp) => list.find((t) => re.test(t.symbol))?.lastPrice ?? null;
    const thesis = desk?.thesis ?? desk;
    return {
      btcPrice: find(/BTC/i),
      ethPrice: find(/ETH/i),
      solPrice: find(/SOL/i),
      btcEtfFlow: desk?.etfBtc?.latest?.totalNetInflow ?? null,
      ethEtfFlow: desk?.etfEth?.latest?.totalNetInflow ?? null,
      ideaSide: thesis?.side ? formatSideLabel(thesis.side) : null,
      ideaSymbol: thesis?.symbol ? formatPair(thesis.symbol) : null,
      ideaSummary: thesis?.plainEnglish ? sanitizePublicText(thesis.plainEnglish) : null,
    };
  } catch {
    return {};
  }
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="ai-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          window.setTimeout(() => setOk(false), 1200);
        } catch {
          /* ignore */
        }
      }}
    >
      {ok ? 'Copied' : 'Copy'}
    </button>
  );
}

export function AiChatDock() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState(SUGGESTIONS);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }, [messages, open, busy, reduce]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const visibleSuggestions = useMemo(() => suggestions.slice(0, 3), [suggestions]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    try {
      const deskContext = await readDeskContext();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          message,
          stream: true,
          history: messages.slice(-6),
          deskContext,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Assistant unavailable');
      }

      const ctype = res.headers.get('content-type') || '';
      if (ctype.includes('application/json')) {
        const json = (await res.json()) as { reply?: string; suggestions?: string[] };
        const reply = sanitizeAssistantReply(json.reply ?? '');
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: 'assistant', content: reply || 'Try asking how to start.' };
          return next;
        });
        if (json.suggestions?.length) setSuggestions(json.suggestions);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buf = '';
      let assembled = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as {
              type?: string;
              text?: string;
              reply?: string;
              suggestions?: string[];
            };
            if (evt.type === 'token' && evt.text) {
              assembled += evt.text;
              const shown = sanitizeAssistantReply(assembled);
              setMessages((m) => {
                const next = [...m];
                next[next.length - 1] = { role: 'assistant', content: shown };
                return next;
              });
            }
            if (evt.type === 'done') {
              const final = sanitizeAssistantReply(evt.reply ?? assembled);
              setMessages((m) => {
                const next = [...m];
                next[next.length - 1] = { role: 'assistant', content: final };
                return next;
              });
              if (evt.suggestions?.length) setSuggestions(evt.suggestions);
            }
          } catch {
            /* ignore bad chunk */
          }
        }
      }
      if (!assembled) {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: 'assistant', content: 'Try asking how to start.' };
          return next;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: 'assistant',
          content: e instanceof Error ? e.message : 'Something went wrong. Please try again.',
        };
        return next;
      });
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
                  <div key={`${m.role}-${i}`} className={`ai-row ai-row-${m.role}`}>
                    {m.role === 'assistant' ? <AiOrb size={22} active={busy && i === messages.length - 1} /> : <span />}
                    <div className={`ai-bubble ai-bubble-${m.role}`}>
                      {m.role === 'assistant' ? (
                        m.content ? (
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        ) : (
                          <span className="ai-typing">Thinking…</span>
                        )
                      ) : (
                        m.content
                      )}
                      {m.role === 'assistant' && m.content ? <CopyButton text={m.content} /> : null}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="ai-suggestions">
                {visibleSuggestions.map((s) => (
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
                  placeholder="Ask about prices or the desk…"
                  aria-label="Message"
                  maxLength={1200}
                />
                <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
                  Send
                </button>
              </form>
              <p className="ai-footer-note">Not financial advice. I never send an order.</p>
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
