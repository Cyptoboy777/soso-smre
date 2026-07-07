'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Volume2, VolumeX, Mic, MicOff, Wifi, Activity, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';
import SoDoggyBody from './SoDoggyBody';
import useSpeech from './hooks/useSpeech';
import { useSodexStore } from '@/store/sodexStore';
import { Maximize2, Minimize2 } from 'lucide-react';

// ── Page-specific guidance — SoSo Dude! style ──
const PAGE_GUIDANCE: Record<string, string> = {
  '/dashboard':     "SoSo Dude! 🤙 Intelligence Terminal is live! I'm scanning market flows and sentiment in real-time!",
  '/sodex-markets': "SoSo Dude! 🚀 SoDEX Trading Floor — order book is hot! I'll alert you when the perfect entry hits!",
  '/breaking-news': "SoSo Dude! 📡 Breaking News feed active! I'm tracking every market-moving event live!",
  '/ai-analysis':   "SoSo Dude! 🧠 AI Engine ready! Gemini 2.5 + Groq LLaMA are crushing on-chain signals for you!",
  '/portfolio':     "SoSo Dude! 💼 Your Portfolio is looking fresh! Let's track that P&L across the chain!",
  '/trading-bot':   "SoSo Dude! 🤖 Bot terminal online! Ready to automate those alpha trades!",
  '/backtest':      "SoSo Dude! 🔬 Backtest engine loaded! Let's validate your strategy against history!",
  '/etf-dashboard': "SoSo Dude! 📈 ETF flows are live! Institutional money moving — let's analyze it!",
};

const COLOR_MAP: Record<string, string> = {
  excited: '#f59e0b', happy: '#2bd9a8', alert: '#ff1744', sad: '#3b82f6', neutral: '#00e5ff',
};

// 5-min wave = SILENT handshake only — no message, no speech
const WAVE_SILENT_ONLY = true;

export default function SoDoggyAssistant() {
  const pathname = usePathname();
  const { speak, speaking, cancel } = useSpeech();

  const [chatOpen,    setChatOpen]    = useState(false);
  const [isExpanded,  setIsExpanded]  = useState(false);
  const [isHovered,   setIsHovered]   = useState(false);
  // ── VOICE TOGGLE STATE ──
  const [micOn,       setMicOn]       = useState(false);   // true = actively listening (toggle)
  const [isWaving,    setIsWaving]    = useState(false);
  const [isIdle,      setIsIdle]      = useState(false);
  const [userName,    setUserName]    = useState<string | null>(null);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [muted,       setMuted]       = useState(false);
  const [sessionMsgs, setSessionMsgs] = useState(0);
  const [history, setHistory] = useState<Array<{
    role: 'dog' | 'user'; text: string; emotion?: string; ts?: string;
  }>>([{
    role: 'dog',
    text: "SoSo Dude! 🤙 SoDoggy v4 neural link established! Blockchain scanner active — let's find some alpha!",
    emotion: 'excited',
    ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  }]);

  const chatEndRef     = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const idleTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerList = useSodexStore(state => state.tickerList);

  // ── Load username ──
  useEffect(() => {
    const n = localStorage.getItem('sodoggy_username');
    if (n) setUserName(n);
  }, []);

  // ── Auto-scroll ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  // ── Idle timer: go transparent 12s after chat closes ──
  useEffect(() => {
    if (chatOpen) {
      setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    } else {
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 12_000);
    }
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [chatOpen]);

  // ── 5-minute SILENT wave (handshake only — no talk, no message) ──
  useEffect(() => {
    waveTimerRef.current = setInterval(() => {
      if (chatOpen) return;
      // Only animate — no speech, no chat message
      setIsWaving(true);
      setIsIdle(false);
      setTimeout(() => setIsWaving(false), 4500);
    }, 5 * 60 * 1000);
    return () => { if (waveTimerRef.current) clearInterval(waveTimerRef.current); };
  }, [chatOpen]);

  const triggerWave = (msg: string) => {
    setIsWaving(true);
    setIsIdle(false);
    setTimeout(() => setIsWaving(false), 4500);
    if (!muted) speak(msg, 'excited');
    addDogMsg(msg, 'excited');
  };


  // ══════════════════════════════════════════════════
  //  VOICE TOGGLE — single click starts, click again stops
  // ══════════════════════════════════════════════════
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;  // prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setMicOn(false);
  }, []);



  const startContinuousListening = useCallback(() => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser.'); return; }

    const rec = new SR();
    rec.continuous      = true;   // ← stays ON until manually stopped
    rec.interimResults  = false;
    rec.lang            = '';     // auto-detect language
    rec.maxAlternatives = 1;

    rec.onstart = () => setMicOn(true);

    rec.onresult = (e: any) => {
      // Get the latest transcript
      const idx = e.resultIndex;
      if (e.results[idx].isFinal) {
        const transcript = e.results[idx][0].transcript.trim();
        if (transcript) handleSendRef.current(transcript);
      }
    };

    // Auto-restart on unexpected end (e.g. silence timeout)
    rec.onend = () => {
      // If mic is still supposed to be ON, restart automatically
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopListening();
        addDogMsg("Ruh-roh! Microphone permission denied! Please allow mic access in browser settings, Raggy!", 'alert');
      }
    };

    rec.start();
    recognitionRef.current = rec;
    setMicOn(true);
  }, []);

  const toggleMic = useCallback(() => {
    if (micOn) {
      stopListening();
    } else {
      startContinuousListening();
    }
  }, [micOn, stopListening, startContinuousListening]);

  // ── Cancel ALL voice (speech synthesis + recognition) ──
  const cancelAllVoice = useCallback(() => {
    cancel();
    stopListening();
  }, [cancel, stopListening]);

  // ── When chat closes → stop mic too ──
  const closeChat = () => {
    setChatOpen(false);
    cancelAllVoice();
  };

  const addDogMsg = (text: string, emotion = 'neutral') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setHistory(p => [...p, { role: 'dog', text, emotion, ts }]);
  };

  const handleAvatarClick = () => {
    setIsIdle(false);
    if (chatOpen) { closeChat(); return; }
    setChatOpen(true);

    const savedName = localStorage.getItem('sodoggy_username');
    if (!savedName) {
      const intro = "SoSo Dude! 🤙 I'm SoDoggy, your AI market analyst! What's your name, Dude?";
      speak(intro, 'excited');
      addDogMsg(intro, 'excited');
      return;
    }
    const page    = pathname || '/';
    const pageMsg = PAGE_GUIDANCE[page] ?? `SoSo Dude! 🤙 I'm on the ${page.replace('/', '') || 'hub'} page with you!`;
    const greeting = `SoSo Dude! ${savedName}! ${pageMsg}`;
    speak(greeting, 'happy');
    addDogMsg(greeting, 'happy');
  };


  const handleSend = async (overrideMsg?: string) => {
    const msg = overrideMsg || input.trim();
    if (!msg || loading) return;
    setInput('');
    const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setHistory(p => [...p, { role: 'user', text: msg, ts }]);
    setLoading(true);
    setSessionMsgs(v => v + 1);

    try {
      if (!userName) {
        const name = msg.trim().split(' ').slice(-1)[0];
        localStorage.setItem('sodoggy_username', name);
        setUserName(name);
        const reply = `SoSo Dude! ${name}! 🤙 I'm SoDoggy — your elite AI market analyst! Let's stack some alpha together, Dude!`;
        addDogMsg(reply, 'excited');
        speak(reply, 'excited');
        setLoading(false);
        return;
      }


      const [newsRes] = await Promise.allSettled([
        fetch('/api/news').then(r => r.json()),
      ]);
      const news = newsRes.status === 'fulfilled' ? newsRes.value?.news?.slice(0, 3) : [];
      // Use live WebSocket prices!
      const prices = Object.fromEntries(tickerList.slice(0, 10).map(t => [t.symbol, t.lastPrice]));

      const res  = await fetch('/api/dog-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, prices, news }),
      });
      const data = await res.json();
      const emos = ['excited', 'happy', 'alert', 'neutral'];
      const emo  = emos[Math.floor(Math.random() * emos.length)];
      addDogMsg(data.reply, emo);
      if (!muted) speak(data.reply, emo);
    } catch {
      addDogMsg('Connection lost! Signal interrupted — please try again.', 'alert');
    } finally {

      setLoading(false);
    }
  };

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const emotion   = history[history.length - 1]?.emotion || 'neutral';
  const tc        = COLOR_MAP[emotion] || '#00e5ff';
  const bodyAction = isWaving ? 'waving' : speaking ? 'talking' : micOn ? 'listening' : 'idle';

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={{ left: -1400, right: 0, top: -900, bottom: 0 }}
      onDragStart={cancelAllVoice}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, cursor: 'grab', userSelect: 'none' }}
    >
      {/* ═══ CHAT TERMINAL ═══ */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ 
              opacity: 1, y: 0, scale: 1,
              width: isExpanded ? 'calc(100vw - 40px)' : 360,
              height: isExpanded ? 'calc(100vh - 180px)' : 'auto',
              bottom: isExpanded ? 155 : 155,
              right: isExpanded ? 20 : 0
            }}
            exit={{ opacity: 0, y: 14, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            style={{
              position: 'absolute',
              background: 'linear-gradient(160deg, #05050f 0%, #080818 60%, #060612 100%)',
              border: `1px solid ${tc}28`,
              borderRadius: 20, overflow: 'hidden',
              boxShadow: `0 28px 70px rgba(0,0,0,0.85), 0 0 0 1px ${tc}12, 0 0 50px ${tc}06`,
              display: 'flex', flexDirection: 'column'
            }}
          >
            {/* Terminal header */}
            <div style={{ padding: '8px 14px', background: `linear-gradient(90deg, rgba(0,0,0,0.5), ${tc}06)`, borderBottom: `1px solid ${tc}18`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {['#ff5f57','#ffbd2e','#28c840'].map((c,i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}80` }} />
                ))}
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: tc, letterSpacing: '0.18em', fontFamily: 'var(--font-mono)' }}>
                  SoSo NEURAL TERMINAL v4
                </span>
              </div>

              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <motion.div animate={{ opacity: [1,0.3,1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <Wifi size={9} color={tc} />
                </motion.div>
                <button onClick={() => setMuted(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {muted ? <VolumeX size={11} color="#444" /> : <Volume2 size={11} color={tc} />}
                </button>
                <button onClick={() => setIsExpanded(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {isExpanded ? <Minimize2 size={11} color="#444" /> : <Maximize2 size={11} color={tc} />}
                </button>
                <button onClick={closeChat} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={11} color="#444" />
                </button>
              </div>
            </div>

            {/* Stats bar */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${tc}10`, background: 'rgba(0,0,0,0.3)' }}>
              {[
                { icon: <Activity size={7}/>, label: 'SESSION', val: `${sessionMsgs} MSG` },
                { icon: <Zap size={7}/>,      label: 'ANALYST',  val: userName?.toUpperCase() || 'ANON' },
                { icon: <Wifi size={7}/>,     label: 'MIC',      val: micOn ? '🔴 ON' : 'OFF' },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, padding: '4px 8px', borderRight: i < 2 ? `1px solid ${tc}08` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: tc, marginBottom: 1 }}>
                    {s.icon}
                    <span style={{ fontSize: 7, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 8, fontWeight: 900, color: s.label === 'MIC' && micOn ? '#ff4444' : '#fff', fontFamily: 'var(--font-mono)' }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Scan line + messages */}
            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 280 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, height: 1, zIndex: 10, pointerEvents: 'none', background: `linear-gradient(90deg, transparent, ${tc}30, transparent)` }} />
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {history.map((m, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: m.role === 'user' ? 16 : -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 2 }}
                  >
                    {m.role === 'dog' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: `${tc}18`, border: `1px solid ${tc}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Zap size={6} color={tc} />
                        </div>
                        <span style={{ fontSize: 8, color: tc, fontWeight: 900, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>SoSo.AI</span>

                        <span style={{ fontSize: 7, color: '#252525', fontFamily: 'var(--font-mono)' }}>{m.ts}</span>
                      </div>
                    )}
                    <div style={{
                      maxWidth: '88%', padding: m.role === 'dog' ? '8px 12px' : '6px 11px',
                      borderRadius: m.role === 'dog' ? '3px 14px 14px 14px' : '14px 3px 14px 14px',
                      background: m.role === 'dog' ? `linear-gradient(135deg, ${tc}0c, ${tc}05)` : 'rgba(255,255,255,0.03)',
                      border: m.role === 'dog' ? `1px solid ${tc}20` : '1px solid rgba(255,255,255,0.05)',
                      fontSize: 11, color: m.role === 'dog' ? '#dde' : '#666', lineHeight: 1.55,
                      fontFamily: m.role === 'dog' ? 'var(--font-mono)' : 'inherit',
                    }}>{m.text}</div>
                    
                    {/* Auto-Trade Setup Button if signal detected */}
                    {m.role === 'dog' && (() => {
                      const match = m.text.match(/\b(BUY|SELL|LONG|SHORT|BULLISH|BEARISH)\b.*\b([A-Z]{3,6})\b/i);
                      if (match) {
                        const side = ['BUY','LONG','BULLISH'].includes(match[1].toUpperCase()) ? 'BUY' : 'SELL';
                        const symbol = match[2].toUpperCase();
                        return (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('TradeSignal', { 
                                detail: { side, autoSuggest: true } 
                              }));
                            }}
                            style={{
                              marginTop: 4, padding: '4px 10px',
                              background: side === 'BUY' ? 'rgba(43,217,168,0.1)' : 'rgba(255,107,107,0.1)',
                              border: `1px solid ${side === 'BUY' ? '#2bd9a8' : '#ff6b6b'}`,
                              borderRadius: 4, color: side === 'BUY' ? '#2bd9a8' : '#ff6b6b',
                              fontSize: 9, fontWeight: 900, cursor: 'pointer', fontFamily: 'var(--font-mono)'
                            }}
                          >
                            ⚡ SET UP {side} TRADE ({symbol})
                          </motion.button>
                        );
                      }
                      return null;
                    })()}
                    
                    {m.role === 'user' && <span style={{ fontSize: 7, color: '#252525', fontFamily: 'var(--font-mono)' }}>{m.ts}</span>}
                  </motion.div>
                ))}
                <AnimatePresence>
                  {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {[0,1,2].map(i => (
                        <motion.div key={i} animate={{ y: [0,-5,0], opacity:[0.4,1,0.4] }} transition={{ repeat: Infinity, duration: 0.65, delay: i*0.15 }} style={{ width: 3, height: 3, borderRadius: '50%', background: tc }} />
                      ))}
                      <span style={{ fontSize: 9, color: tc, fontFamily: 'var(--font-mono)', opacity: 0.5 }}>analyzing markets…</span>

                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* ── INPUT BAR ── */}
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${tc}12`, background: 'rgba(0,0,0,0.4)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: tc, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{'>'}</span>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !micOn && handleSend()}
                placeholder={micOn ? '🔴 listening… (click mic to stop)' : 'type or click mic…'}
                disabled={micOn}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: micOn ? tc : '#c8c8e8', fontSize: 11, fontFamily: 'var(--font-mono)', caretColor: tc, cursor: micOn ? 'default' : 'text' }}
              />

              {/* ── MIC TOGGLE BUTTON ── */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                animate={micOn ? { boxShadow: [`0 0 0 0 ${tc}40`, `0 0 0 6px ${tc}00`] } : {}}
                transition={micOn ? { repeat: Infinity, duration: 1 } : {}}
                onClick={toggleMic}
                title={micOn ? 'Click to STOP listening' : 'Click to START listening'}
                style={{
                  background: micOn ? `${tc}25` : 'transparent',
                  border: `1.5px solid ${micOn ? tc : '#333'}`,
                  borderRadius: 8, width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                  boxShadow: micOn ? `0 0 12px ${tc}60` : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {micOn
                  ? <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}><Mic size={12} color={tc} /></motion.div>
                  : <MicOff size={12} color="#555" />
                }
              </motion.button>

              {/* Send (disabled when mic ON) */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => !micOn && handleSend()}
                disabled={micOn}
                style={{
                  background: `linear-gradient(135deg, ${tc}25, ${tc}10)`,
                  border: `1px solid ${tc}30`,
                  borderRadius: 8, width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: micOn ? 'not-allowed' : 'pointer', flexShrink: 0,
                  opacity: micOn ? 0.4 : 1,
                }}
              >
                <Send size={11} color={tc} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ AVATAR + FULL BODY ═══ */}
      <motion.div
        onClick={handleAvatarClick}
        onHoverStart={() => { setIsHovered(true); setIsIdle(false); }}
        onHoverEnd={() => setIsHovered(false)}
        animate={{
          opacity: isIdle && !isHovered ? 0.25 : 1,
          scale:   isIdle && !isHovered ? 0.85 : 1,
          x:       isIdle && !isHovered ? 8 : 0,
          y:       isIdle && !isHovered ? 8 : 0,
        }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        whileHover={{ scale: isIdle ? 1.0 : 1.04 }}
        whileTap={{ scale: 0.93 }}
        style={{ position: 'relative', cursor: 'pointer' }}
      >
        {/* Hover tooltip */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', bottom: '102%', right: 0,
                background: 'rgba(5,5,18,0.95)',
                border: `1px solid ${tc}30`,
                color: tc, fontSize: 9, fontWeight: 700,
                padding: '4px 9px', borderRadius: 8,
                whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)',
                letterSpacing: '0.07em', pointerEvents: 'none',
              }}
            >
              {isIdle ? '👋 Still here! Click me!' : speaking ? '🔊 SPEAKING' : micOn ? '🔴 LISTENING' : chatOpen ? '✕ CLOSE' : '⬤ CHAT WITH SoSo'}

            </motion.div>
          )}
        </AnimatePresence>

        <SoDoggyBody
          speaking={speaking}
          listening={micOn}
          emotion={emotion}
          action={bodyAction as any}
          size={46}
        />
      </motion.div>
    </motion.div>
  );
}
