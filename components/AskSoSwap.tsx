"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { GuardVerdict } from "@/lib/trade-guard";

type Msg = { role: "user" | "bot"; text: string; verdict?: GuardVerdict; reasons?: string[] };

const LABEL: Record<GuardVerdict, string> = { good: "Good to go", wait: "Wait", risky: "Risky" };
const CHIPS = ["Should I buy SOL now?", "Should I buy BTC now?", "What moved on SoDEX today?"];

export default function AskSoSwap({ address }: { address?: string }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);

  async function ask(text = input) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setErr(null);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, ...(address ? { address } : {}) }),
      });
      const data = await r.json().catch(() => null);
      if (r.status === 429) { setErr("Too many questions. Please wait a minute and try again."); return; }
      if (!r.ok) { setErr(typeof data?.error === "string" ? data.error : "Could not load a live answer right now. Please try again."); return; }
      const reply = typeof data?.reply === "string" && data.reply.trim() ? data.reply.trim() : "I could not form an answer. Please try again.";
      setMessages((m) => [...m, { role: "bot", text: reply, verdict: data?.verdict, reasons: Array.isArray(data?.reasons) ? data.reasons : undefined }]);
    } catch {
      setErr("Could not load a live answer right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ss-ask" data-testid="ask-soswap" aria-label="Ask SoSwap">
      <div className="ss-ask__head">
        <div>
          <div className="ss-ask__title flex items-center gap-2"><Sparkles className="h-4 w-4 text-orange-400" />Ask SoSwap</div>
          <p className="ss-ask__sub">Live SoDEX and SoSoValue data, plus a Trade Guard grade. It never places an order.</p>
        </div>
      </div>
      {!messages.length && (
        <div className="ss-ask__chips">
          {CHIPS.map((c) => <button key={c} type="button" className="ss-ask__chip" onClick={() => ask(c)}>{c}</button>)}
        </div>
      )}
      <div className="ss-ask__thread">
        {messages.map((m, i) => (
          <div key={i} className={`ss-ask__bubble is-${m.role}`}>
            {m.role === "bot" && m.verdict && (
              <div className="mb-1.5">
                <span className="ss-guard__badge" data-verdict={m.verdict} style={{
                  background: m.verdict === "good" ? "rgba(16,185,129,0.16)" : m.verdict === "wait" ? "rgba(249,115,22,0.16)" : "rgba(244,63,94,0.16)",
                  color: m.verdict === "good" ? "#6ee7b7" : m.verdict === "wait" ? "#fdba74" : "#fda4af",
                }}>Trade Guard: {LABEL[m.verdict]}</span>
              </div>
            )}
            {m.text}
          </div>
        ))}
        {busy && <div className="ss-ask__bubble is-bot">Checking live data…</div>}
      </div>
      {err && <p className="ss-ask__err" role="alert">{err}</p>}
      <form className="ss-ask__form" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={400}
          placeholder="Ask, e.g. Should I buy SOL now?"
          aria-label="Ask SoSwap a question"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>Ask</button>
      </form>
      <p className="ss-ask__nfa">Not financial advice. You review and sign every order yourself.</p>
    </section>
  );
}
