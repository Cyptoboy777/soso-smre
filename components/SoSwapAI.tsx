"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./soswap-ai.css";
import AnimalOrb, { ANIMALS, type AnimalKind, type Expression } from "./AnimalFace";
import { BarChart3, Newspaper, Repeat, Search, Volume2, VolumeX } from "lucide-react";
import { parseSwapCommand } from "@/lib/voice-command";
import { primeAudio, speak, stopSpeaking, voiceSupported } from "@/lib/voice";

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
  { icon: Repeat, label: "Find best route", ask: "How does SoSwapDEX find the best route for a swap on SoDEX?" },
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
        {beat.bubble === "hello" && <div className="ss-bubble" key="hello">Hello! I&apos;m SoSwapDEX AI<div className="ss-wave">{Array.from({ length: 11 }).map((_, k) => <i key={k} />)}</div></div>}
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

const BOT_KEY = "soswap.bot.v2";
const VOICE_KEY = "soswap.voice.v1";

export default function SoSwapAI() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [kind, setKind] = useState<AnimalKind>("robot");
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const voiceRef = useRef(false);
  const talking = busy || speaking;
  useEffect(() => {
    setCanSpeak(voiceSupported());
    try { if (localStorage.getItem(VOICE_KEY) === "1") { setVoiceOn(true); voiceRef.current = true; } } catch { /* storage unavailable */ }
    return () => stopSpeaking();
  }, []);
  const say = (text: string) => speak(text, { start: () => setSpeaking(true), end: () => setSpeaking(false) });
  const toggleVoice = () => {
    const on = !voiceOn;
    setVoiceOn(on); voiceRef.current = on;
    try { localStorage.setItem(VOICE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
    if (on) { primeAudio(); say("Voice is on."); } else { stopSpeaking(); setSpeaking(false); }
  };
  useEffect(() => {
    try { const k = localStorage.getItem(BOT_KEY) as AnimalKind | null; if (k && ANIMALS.some((a) => a.kind === k)) setKind(k); } catch { /* storage unavailable */ }
  }, []);
  const pick = (k: AnimalKind) => { setKind(k); try { localStorage.setItem(BOT_KEY, k); } catch { /* ignore */ } };
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hey, I'm SoSwapDEX AI. I can explain swaps, routes and wallet safety, and I can read live SoDEX market data and SoSoValue headlines. I never ask for your seed phrase and I can't sign or send anything for you. What are we looking at?",
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
    const cmd = parseSwapCommand(trimmed);
    if (cmd) {
      // A swap request fills the Swap form on this device. Nothing is sent and nothing is signed.
      const detail: { from: string; to: string; amount: string; result?: string } = { ...cmd };
      window.dispatchEvent(new CustomEvent("soswap:swap-fill", { detail }));
      if (detail.result) {
        const reply = detail.result === "ok"
          ? `Done. I filled the Swap form with ${cmd.amount} ${cmd.from} to ${cmd.to}. Nothing has been sent. Check the route and total cost, then sign it yourself.`
          : `I could not find ${cmd.from} or ${cmd.to} on SoDEX. Check the names and try again.`;
        setMessages((current) => [...current, { role: "assistant", content: reply }]);
        if (voiceRef.current) say(reply);
        if (detail.result === "ok" && window.matchMedia("(max-width: 520px)").matches) setOpen(false);
        return;
      }
    }
    setBusy(true);
    stopSpeaking(); setSpeaking(false);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Assistant request failed.");
      const reply = data.reply || "I couldn't form a reply. Please try again.";
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      if (voiceRef.current) say(reply);
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
      if (voiceRef.current && transcript.trim()) void sendMessage(transcript);
      else setInput((current) => current ? `${current} ${transcript}` : transcript);
    };
    stopSpeaking(); setSpeaking(false); primeAudio();
    recognition.start();
  }

  return (
    <>
      <button
        className="ss-launcher"
        type="button"
        aria-label={open ? "Close SoSwapDEX AI" : "Open SoSwapDEX AI"}
        onClick={() => { if (open) { stopSpeaking(); setSpeaking(false); } setOpen((value) => !value); }}
      >
        {open ? <span className="ss-launcher__close">×</span> : <Orb compact kind={kind} talking={talking} />}
        {!open && <span className="ss-launcher__ping" />}
      </button>

      <AnimatePresence>
      {open && (
        <motion.section className="ss-panel" aria-label="SoSwapDEX AI assistant"
          initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.16 } }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} style={{ transformOrigin: "bottom right" }}>
          <header className="ss-panel__header">
            <div className="ss-panel__identity">
              <button type="button" className="ss-panel__orbbtn" onClick={() => setShowPick((v) => !v)} aria-expanded={showPick} aria-label="Change bot face" title="Change bot face"><Orb compact kind={kind} talking={talking} /></button>
              <div>
                <div className="ss-panel__name">SoSwapDEX AI <span className="ss-beta">BETA</span></div>
                <div className="ss-panel__status"><i /> Your Web3 co-pilot</div>
              </div>
            </div>
            <div className="ss-panel__actions">
              {canSpeak && <button type="button" className={`ss-icon-button ss-speaker ${voiceOn ? "is-on" : ""}`} onClick={toggleVoice} aria-pressed={voiceOn} aria-label={voiceOn ? "Turn robot voice off" : "Turn robot voice on"} title={voiceOn ? "Robot voice on. Replies are read aloud and the mic sends automatically." : "Turn on robot voice"}>{voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>}
              <button className="ss-icon-button" onClick={() => { stopSpeaking(); setSpeaking(false); setOpen(false); }} aria-label="Close chat">×</button>
            </div>
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
            {messages.length <= 1 && <Hero kind={kind} busy={talking} onAsk={(q) => sendMessage(q)} />}
            {messages.map((message, index) => (
              <div className={`ss-message ss-message--${message.role}`} key={`${message.role}-${index}`}>
                {message.role === "assistant" && <div className="ss-message__avatar"><Orb compact kind={kind} talking={talking && index === messages.length - 1} /></div>}
                <div className="ss-message__bubble">{message.content}{message.role === "assistant" && canSpeak && index > 0 && <button type="button" className="ss-replay" onClick={() => { primeAudio(); say(message.content); }} aria-label="Read this reply aloud" title="Read aloud"><Volume2 size={13} /></button>}</div>
              </div>
            ))}
            {busy && (
              <div className="ss-message ss-message--assistant">
                <div className="ss-message__avatar"><Orb compact kind={kind} talking={talking} /></div>
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
              placeholder="Ask SoSwapDEX AI anything..."
              rows={1}
              maxLength={2000}
              aria-label="Message SoSwapDEX AI"
            />
            <button
              className={`ss-voice ${listening ? "is-listening" : ""}`}
              type="button"
              onClick={startVoiceInput}
              aria-label="Use voice input"
              title={voiceOn ? "Speak. Your question is sent when you stop talking. Uses your browser's speech service." : "Voice input (uses your browser's speech service)"}
            >{listening ? "●" : "⌁"}</button>
            <button className="ss-send" type="submit" disabled={!input.trim() || busy} aria-label="Send message">↑</button>
          </form>
          <footer className="ss-panel__footer">
            <span>AI can make mistakes. Verify all trading information.</span>
            <span>Never share your seed phrase.</span>
          </footer>
        </motion.section>
      )}
      </AnimatePresence>
    </>
  );
}
