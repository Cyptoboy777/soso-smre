"use client";

import { useEffect, useRef, useState } from "react";
import "./soswap-ai.css";
import AnimalOrb, { ANIMALS, type AnimalKind, type Expression } from "./AnimalFace";
import { BarChart3, Newspaper, Repeat, Search } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Explain how a SoDEX swap works",
  "What should I check before signing?",
  "Explain slippage, spread and gas",
  "What are the top movers on SoDEX right now?",
];

function Orb({ compact = false, kind, talking = false }: { compact?: boolean; kind: AnimalKind; talking?: boolean }) {
  return <AnimalOrb kind={kind} talking={talking} compact={compact} />;
}


type Beat = { expr: Expression; ms: number; bubble?: "hello" | "menu" | "swap" };
const SCRIPT: Beat[] = [
  { expr: "happy", ms: 2200 },
  { expr: "talk", ms: 3000, bubble: "hello" },
  { expr: "wink", ms: 1700 },
  { expr: "angry", ms: 1500 },
  { expr: "talk", ms: 5600, bubble: "menu" },
  { expr: "happy", ms: 2000 },
  { expr: "talk", ms: 2800, bubble: "swap" },
];
const MENU = [
  { icon: BarChart3, label: "Check market", ask: "What are the top movers on SoDEX right now?" },
  { icon: Search, label: "Analyze token", ask: "What should I check before trading a token I don't know well?" },
  { icon: Repeat, label: "Find best route", ask: "How does SoSwap find the best route for a swap on SoDEX?" },
  { icon: Newspaper, label: "Check news", ask: "What are the latest SoSoValue headlines?" },
];

/** The big orb runs a short scripted loop (greeting, wink, focus, quick-action menu), like a living mascot. */
function Hero({ kind, busy, onAsk }: { kind: AnimalKind; busy: boolean; onAsk: (q: string) => void }) {
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (hover || busy) return;
    const t = setTimeout(() => setI((n) => (n + 1) % SCRIPT.length), SCRIPT[i].ms);
    return () => clearTimeout(t);
  }, [i, hover, busy]);
  const beat = busy ? { expr: "talk" as Expression, ms: 0, bubble: undefined } : SCRIPT[i];
  return (
    <div className="ss-hero">
      <AnimalOrb kind={kind} talking={busy} expression={beat.expr} stage />
      <div className="ss-hero__stage" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {beat.bubble === "hello" && <div className="ss-bubble" key="hello">Hello! I&apos;m SoSwap AI<div className="ss-wave">{Array.from({ length: 11 }).map((_, k) => <i key={k} />)}</div></div>}
        {beat.bubble === "swap" && <div className="ss-bubble" key="swap">Let&apos;s swap together!<div className="ss-wave">{Array.from({ length: 11 }).map((_, k) => <i key={k} />)}</div></div>}
        {beat.bubble === "menu" && (
          <div className="ss-bubble ss-bubble--menu" key="menu">
            {MENU.map(({ icon: Icon, label, ask }) => <button key={label} type="button" onClick={() => onAsk(ask)}><Icon size={14} />{label}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

const BOT_KEY = "soswap.bot.v1";

export default function SoSwapAI() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [kind, setKind] = useState<AnimalKind>("orb");
  useEffect(() => {
    try { const k = localStorage.getItem(BOT_KEY) as AnimalKind | null; if (k && ANIMALS.some((a) => a.kind === k)) setKind(k); } catch { /* storage unavailable */ }
  }, []);
  const pick = (k: AnimalKind) => { setKind(k); try { localStorage.setItem(BOT_KEY, k); } catch { /* ignore */ } };
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hey, I'm SoSwap AI. I can explain swaps, routes and wallet safety, and I can read live SoDEX market data and SoSoValue headlines. I never ask for your seed phrase and I can't sign or send anything for you. What are we looking at?",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messages.length > 1 || busy) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, open]);

  async function sendMessage(text = input) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Assistant request failed.");
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply || "I couldn't form a reply. Please try again." },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: message,
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function startVoiceInput() {
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Voice input isn't supported in this browser. You can type your question instead." },
      ]);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setInput((current) => current ? `${current} ${transcript}` : transcript);
    };
    recognition.start();
  }

  return (
    <>
      <button
        className="ss-launcher"
        type="button"
        aria-label={open ? "Close SoSwap AI" : "Open SoSwap AI"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <span className="ss-launcher__close">×</span> : <Orb compact kind={kind} talking={busy} />}
        {!open && <span className="ss-launcher__ping" />}
      </button>

      {open && (
        <section className="ss-panel" aria-label="SoSwap AI assistant">
          <header className="ss-panel__header">
            <div className="ss-panel__identity">
              <button type="button" className="ss-panel__orbbtn" onClick={() => setShowPick((v) => !v)} aria-expanded={showPick} aria-label="Change bot face" title="Change bot face"><Orb compact kind={kind} talking={busy} /></button>
              <div>
                <div className="ss-panel__name">SoSwap AI <span className="ss-beta">BETA</span></div>
                <div className="ss-panel__status"><i /> Your Web3 co-pilot</div>
              </div>
            </div>
            <button className="ss-icon-button" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </header>

          {showPick && <div className="ss-picker" role="group" aria-label="Choose your bot face">
            <span className="ss-picker__label">CHOOSE YOUR BOT</span>
            {ANIMALS.map((a) => (
              <button key={a.kind} type="button" aria-pressed={kind === a.kind} aria-label={`${a.label} — ${a.vibe}`} title={`${a.label} — ${a.vibe}`} onClick={() => pick(a.kind)}>
                <AnimalOrb kind={a.kind} size={40} compact still />
              </button>
            ))}
          </div>
          }

          <main className="ss-chat">
            {messages.length <= 1 && <Hero kind={kind} busy={busy} onAsk={(q) => sendMessage(q)} />}
            {messages.map((message, index) => (
              <div className={`ss-message ss-message--${message.role}`} key={`${message.role}-${index}`}>
                {message.role === "assistant" && <div className="ss-message__avatar"><Orb compact kind={kind} talking={busy} /></div>}
                <div className="ss-message__bubble">{message.content}</div>
              </div>
            ))}
            {busy && (
              <div className="ss-message ss-message--assistant">
                <div className="ss-message__avatar"><Orb compact kind={kind} talking={busy} /></div>
                <div className="ss-message__bubble ss-typing"><i /><i /><i /><span>Thinking</span></div>
              </div>
            )}
            <div ref={endRef} />
          </main>

          {messages.length <= 1 && (
            <div className="ss-suggestions">
              <span className="ss-suggestions__label">TRY ASKING</span>
              {suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => sendMessage(suggestion)}>{suggestion}<b>↗</b></button>
              ))}
            </div>
          )}

          <form
            className="ss-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask SoSwap AI anything..."
              rows={1}
              maxLength={2000}
              aria-label="Message SoSwap AI"
            />
            <button
              className={`ss-voice ${listening ? "is-listening" : ""}`}
              type="button"
              onClick={startVoiceInput}
              aria-label="Use voice input"
              title="Voice input"
            >{listening ? "●" : "⌁"}</button>
            <button className="ss-send" type="submit" disabled={!input.trim() || busy} aria-label="Send message">↑</button>
          </form>
          <footer className="ss-panel__footer">
            <span>AI can make mistakes. Verify all trading information.</span>
            <span>Never share your seed phrase.</span>
          </footer>
        </section>
      )}
    </>
  );
}
