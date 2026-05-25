'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Square, Mic, Volume2, VolumeX, RefreshCw,
  TrendingUp, TrendingDown, Zap, Activity, Newspaper,
} from 'lucide-react';

// ── Emotion config ──────────────────────────────────────────────────────────
type Emotion = 'divine' | 'joy' | 'alert' | 'serious';

const EMOTION_CFG: Record<Emotion, { label: string; color: string; glow: string; emoji: string; desc: string }> = {
  divine:  { label: 'DIVINE',  color: '#a78bfa', glow: 'rgba(167,139,250,0.5)', emoji: '✨', desc: 'Calm & Insightful' },
  joy:     { label: 'JOY',     color: '#fbbf24', glow: 'rgba(251,191,36,0.5)',  emoji: '🚀', desc: 'Bullish & Energetic' },
  alert:   { label: 'ALERT',   color: '#f43f5e', glow: 'rgba(244,63,94,0.5)',   emoji: '⚠️', desc: 'Bearish & Urgent' },
  serious: { label: 'SERIOUS', color: '#38bdf8', glow: 'rgba(56,189,248,0.5)',  emoji: '📊', desc: 'Analytical & Deep' },
};

// ── Voice engines ───────────────────────────────────────────────────────────
function pickVoice(voices: SpeechSynthesisVoice[], prefer: 'female' | 'male') {
  const female = ['Samantha', 'Karen', 'Victoria', 'Moira', 'Google UK English Female', 'Microsoft Zira', 'Alice', 'Fiona'];
  const male   = ['Daniel', 'Alex', 'Google UK English Male', 'Microsoft David', 'Fred', 'Tom'];
  const list   = prefer === 'female' ? female : male;
  for (const name of list) {
    const v = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
    if (v) return v;
  }
  return voices.find(v => prefer === 'female' ? v.name.toLowerCase().includes('female') : v.name.toLowerCase().includes('male'))
    || voices[0] || null;
}

function speakLine(
  text: string,
  voice: SpeechSynthesisVoice | null,
  pitch: number,
  rate: number,
  onStart: () => void,
  onEnd: () => void,
) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  if (voice) utt.voice = voice;
  utt.pitch = pitch;
  utt.rate  = rate;
  utt.volume = 1;
  utt.onstart = onStart;
  utt.onend   = onEnd;
  utt.onerror = onEnd;
  window.speechSynthesis.speak(utt);
}

// ── Host avatar (animated orb) ──────────────────────────────────────────────
function HostOrb({
  isSpeaking, emotion, label, tag, side,
}: {
  isSpeaking: boolean; emotion: Emotion; label: string; tag: string; side: 'left' | 'right';
}) {
  const cfg   = EMOTION_CFG[emotion];
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!isSpeaking) return;
    const id = setInterval(() => setF(n => n + 1), 90);
    return () => clearInterval(id);
  }, [isSpeaking]);

  const bars = 14;
  const heights = Array.from({ length: bars }, (_, i) =>
    isSpeaking ? 6 + Math.abs(Math.sin(f * 0.5 + i * 0.7)) * 26 : 4
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 120 }}>
      {/* Orb */}
      <div style={{ position: 'relative', width: 90, height: 90 }}>
        {/* Outer glow rings */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ scale: isSpeaking ? [1, 2.2 + i * 0.4, 1] : [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ repeat: Infinity, duration: isSpeaking ? 0.9 : 2.5, delay: i * 0.28 }}
            style={{
              position: 'absolute', inset: 0, border: `1.5px solid ${cfg.color}`,
              borderRadius: '50%',
            }}
          />
        ))}
        {/* Spinning ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
          style={{
            position: 'absolute', inset: -10,
            border: `1px dashed ${cfg.color}40`,
            borderTopColor: cfg.color,
            borderRadius: '50%',
          }}
        />
        {/* Core sphere */}
        <motion.div
          animate={{
            boxShadow: isSpeaking
              ? [`0 0 30px ${cfg.color}, 0 0 60px ${cfg.glow}`, `0 0 50px ${cfg.color}, 0 0 90px ${cfg.glow}`, `0 0 30px ${cfg.color}, 0 0 60px ${cfg.glow}`]
              : [`0 0 15px ${cfg.color}60`, `0 0 25px ${cfg.color}80`, `0 0 15px ${cfg.color}60`],
            scale: isSpeaking ? [1, 1.07, 0.96, 1] : [1, 1.03, 1],
          }}
          transition={{ repeat: Infinity, duration: isSpeaking ? 0.6 : 3 }}
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 32%, rgba(255,255,255,0.22) 0%, ${cfg.color}35 35%, rgba(0,0,0,0.75) 70%, black 100%)`,
            border: `2px solid ${cfg.color}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}
        >
          {/* Inner pulse */}
          <motion.div
            animate={{ scale: isSpeaking ? [0.4, 0.9, 0.4] : [0.3, 0.55, 0.3], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: isSpeaking ? 0.55 : 2.5 }}
            style={{
              position: 'absolute', inset: '28%', borderRadius: '50%',
              background: `radial-gradient(circle, white 0%, ${cfg.color} 60%, transparent 100%)`,
              filter: 'blur(3px)',
            }}
          />
          <span style={{ position: 'relative', zIndex: 1, fontSize: 20 }}>{cfg.emoji}</span>
        </motion.div>

        {/* ON AIR badge */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              style={{
                position: 'absolute', top: -12, right: -12,
                background: cfg.color, color: '#000',
                fontSize: 7, fontWeight: 900, letterSpacing: '0.12em',
                padding: '2px 6px', borderRadius: 99,
              }}
            >
              ◉ ON AIR
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name tag */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: cfg.color, letterSpacing: '0.1em' }}>{label}</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginTop: 1 }}>{tag}</div>
      </div>

      {/* Waveform */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32 }}>
        {heights.map((h, i) => (
          <motion.div
            key={i}
            animate={{ height: h }}
            transition={{ duration: 0.08 }}
            style={{
              width: 3, borderRadius: 2,
              background: `linear-gradient(to top, ${cfg.color}, ${cfg.color}50)`,
              boxShadow: isSpeaking ? `0 0 4px ${cfg.color}80` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Transcript line ─────────────────────────────────────────────────────────
interface Line { host: 'eva' | 'dog'; emotion: Emotion; text: string; ts: string; }

function TranscriptLine({ line, evaColor, dogColor }: { line: Line; evaColor: string; dogColor: string }) {
  const isEva = line.host === 'eva';
  const color = isEva ? evaColor : dogColor;
  return (
    <motion.div
      initial={{ opacity: 0, x: isEva ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        flexDirection: isEva ? 'row' : 'row-reverse',
      }}
    >
      {/* Avatar chip */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.2), ${color}40)`,
        border: `1.5px solid ${color}60`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 900, color,
      }}>
        {isEva ? 'E' : 'D'}
      </div>
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3,
          flexDirection: isEva ? 'row' : 'row-reverse',
        }}>
          <span style={{ fontSize: 9, fontWeight: 900, color, letterSpacing: '0.1em' }}>
            {isEva ? 'EVA' : 'SODOGGY'}
          </span>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>{line.ts}</span>
          <span style={{ fontSize: 9 }}>{EMOTION_CFG[line.emotion].emoji}</span>
        </div>
        <div style={{
          padding: '10px 14px',
          borderRadius: isEva ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          background: `${color}0f`,
          border: `1px solid ${color}28`,
          fontSize: 12.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.85)',
        }}>
          {line.text}
        </div>
      </div>
    </motion.div>
  );
}

// ── Emotion selector pills ───────────────────────────────────────────────────
function EmotionPills({ current, onChange }: { current: Emotion; onChange: (e: Emotion) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {(Object.keys(EMOTION_CFG) as Emotion[]).map(e => {
        const cfg = EMOTION_CFG[e];
        const active = current === e;
        return (
          <motion.button
            key={e}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => onChange(e)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 99,
              border: `1px solid ${active ? cfg.color : cfg.color + '35'}`,
              background: active ? `${cfg.color}20` : 'transparent',
              color: active ? cfg.color : `${cfg.color}80`,
              fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: active ? `0 0 12px ${cfg.glow}` : 'none',
            }}
          >
            <span>{cfg.emoji}</span>
            <span>{cfg.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PODCAST STUDIO COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function SoEva({ data }: { data?: any }) {
  const [isRunning,    setIsRunning]    = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [isMuted,      setIsMuted]      = useState(false);
  const [emotion,      setEmotion]      = useState<Emotion>('divine');
  const [transcript,   setTranscript]   = useState<Line[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<'eva' | 'dog' | null>(null);
  const [marketData,   setMarketData]   = useState<any>(null);
  const [newsData,     setNewsData]     = useState<any[]>([]);
  const [episodeNum,   setEpisodeNum]   = useState(1);
  const [round,        setRound]        = useState(0);

  const voicesRef      = useRef<SpeechSynthesisVoice[]>([]);
  const evaVoiceRef    = useRef<SpeechSynthesisVoice | null>(null);
  const dogVoiceRef    = useRef<SpeechSynthesisVoice | null>(null);
  const runningRef     = useRef(false);
  const mutedRef       = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // sync muted ref
  useEffect(() => { mutedRef.current = isMuted; }, [isMuted]);

  // auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // load voices
  useEffect(() => {
    const load = () => {
      const vs = window.speechSynthesis.getVoices();
      if (vs.length > 0) {
        voicesRef.current = vs;
        evaVoiceRef.current = pickVoice(vs, 'female');
        dogVoiceRef.current = pickVoice(vs, 'male');
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  // fetch live market + news data
  const fetchLiveData = useCallback(async () => {
    try {
      const [pricesRes, newsRes, etfRes] = await Promise.allSettled([
        fetch('/api/prices').then(r => r.json()),
        fetch('/api/news').then(r => r.json()),
        fetch('/api/etf').then(r => r.json()).catch(() => null),
      ]);
      if (pricesRes.status === 'fulfilled') setMarketData(pricesRes.value);
      if (newsRes.status === 'fulfilled') setNewsData(newsRes.value?.news?.slice(0, 5) || []);
    } catch {}
  }, []);

  // speak a line
  const speakLine_ = useCallback((
    text: string,
    host: 'eva' | 'dog',
    emo: Emotion,
  ): Promise<void> => new Promise(resolve => {
    if (mutedRef.current) { setTimeout(resolve, 800); return; }
    const voice = host === 'eva' ? evaVoiceRef.current : dogVoiceRef.current;
    const pitch  = host === 'eva' ? 1.25 : 0.82;
    const rate   = host === 'eva' ? 0.96 : 1.05;
    setActiveSpeaker(host);
    speakLine(text, voice, pitch, rate, () => {}, () => {
      setActiveSpeaker(null);
      resolve();
    });
  }), []);

  // add a line to transcript + speak
  const say = useCallback(async (host: 'eva' | 'dog', emo: Emotion, text: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setTranscript(p => [...p, { host, emotion: emo, text, ts }]);
    setEmotion(emo);
    if (!mutedRef.current && runningRef.current) await speakLine_(text, host, emo);
  }, [speakLine_]);

  // Build podcast script from live data
  const buildScript = useCallback((md: any, news: any[]) => {
    const btc = md?.btc ? `$${Number(md.btc).toLocaleString()}` : '$—';
    const eth = md?.eth ? `$${Number(md.eth).toLocaleString()}` : '$—';
    const soso = md?.soso ? `$${Number(md.soso).toFixed(4)}` : '$—';
    const btcChange = md?.prices?.find((p: any) => p.symbol.includes('BTC'))?.change;
    const btcUp = btcChange ? parseFloat(btcChange) >= 0 : true;
    const mcap = md?.globalMarketCap || '—';

    const headline1 = news?.[0]?.title || 'Crypto markets show mixed signals today';
    const headline2 = news?.[1]?.title || 'Institutional accumulation continues across major tokens';
    const headline3 = news?.[2]?.title || 'DeFi TVL holds steady despite market volatility';

    const btcEmo: Emotion = btcUp ? (parseFloat(btcChange || '0') > 4 ? 'joy' : 'divine') : (parseFloat(btcChange || '0') < -4 ? 'alert' : 'serious');

    type ScriptLine = { host: 'eva' | 'dog'; emo: Emotion; text: string };
    const script: ScriptLine[] = [
      {
        host: 'eva', emo: 'divine',
        text: `Welcome to SoSo SMRE Podcast — your elite AI crypto intelligence briefing. I'm Eva, your divine market analyst.`,
      },
      {
        host: 'dog', emo: 'joy',
        text: `SoSo Dude! 🤙 And I'm SoDoggy — the alpha hunter! Let's break down today's market action. What's the opening picture, Eva?`,
      },
      {
        host: 'eva', emo: btcEmo,
        text: `Bitcoin is holding at ${btc} right now — ${btcChange ? (btcUp ? `up ${btcChange}% — bulls are firmly in control.` : `down ${btcChange}% — bears testing support.`) : 'price action is consolidating.'} Ethereum sits at ${eth}. Global market cap is at ${mcap}.`,
      },
      {
        host: 'dog', emo: btcEmo,
        text: `SoSo Dude! ${btcUp ? 'Green candles all day! Smart money is accumulating. This is the dip buyers\'s market right now!' : 'Riskoff mode activated! The whales are sitting on their hands. Watch those support levels closely!'}`,
      },
      {
        host: 'eva', emo: 'serious',
        text: `Breaking news from SoSoValue feeds — ${headline1}. This could be a significant catalyst for the next leg ${btcUp ? 'up' : 'down'}.`,
      },
      {
        host: 'dog', emo: 'alert',
        text: `SoSo Dude! Also tracking this — ${headline2}. That's institutional flow language right there. When the big players move, we follow the trail!`,
      },
      {
        host: 'eva', emo: 'divine',
        text: `On the SoDEX front, SOSO token is trading at ${soso}. The on-chain liquidity pools are ${btcUp ? 'deepening — confidence is building' : 'tightening — traders taking risk off'}. DeFi signal: ${headline3}.`,
      },
      {
        host: 'dog', emo: 'joy',
        text: `SoSo Dude! My AI signal scanner is reading ${btcUp ? 'BUY pressure across the board! The volume profile is bullish! Momentum traders are stepping in!' : 'caution signals! Volume divergence detected! Wait for confirmation before entering new longs!'}`,
      },
      {
        host: 'eva', emo: 'serious',
        text: `Risk management reminder — always set your stop losses. The SoSo SMRE AI signal page gives you exact entry, target, and stop levels. Use the Backtest engine to validate your strategy.`,
      },
      {
        host: 'dog', emo: 'joy',
        text: `SoSo Dude! That's a wrap on today's briefing! Stay sharp, stack knowledge, and always DYOR. This has been SoSo SMRE Podcast — catch you on the next episode!`,
      },
      {
        host: 'eva', emo: 'divine',
        text: `This analysis is for informational purposes only. Not financial advice. Stay disciplined, stay aligned with the data, and may the markets move in your favor. Farewell, analyst.`,
      },
    ];
    return script;
  }, []);

  // Main podcast runner
  const runPodcast = useCallback(async () => {
    runningRef.current = true;
    setIsLoading(true);
    setTranscript([]);
    setRound(r => r + 1);

    await fetchLiveData();

    // small pause to let state update
    await new Promise(r => setTimeout(r, 600));

    setIsLoading(false);

    const md   = marketData;
    const news = newsData;
    const script = buildScript(md, news);

    for (const line of script) {
      if (!runningRef.current) break;
      await say(line.host, line.emo, line.text);
      await new Promise(r => setTimeout(r, 320)); // gap between hosts
    }

    runningRef.current = false;
    setIsRunning(false);
    setActiveSpeaker(null);
  }, [fetchLiveData, marketData, newsData, buildScript, say]);

  const startPodcast = async () => {
    if (isRunning || isLoading) return;
    setIsRunning(true);
    setEpisodeNum(n => n + 1);
    await runPodcast();
  };

  const stopPodcast = () => {
    runningRef.current = false;
    window.speechSynthesis.cancel();
    setIsRunning(false);
    setActiveSpeaker(null);
  };

  // Auto-fetch on mount
  useEffect(() => { fetchLiveData(); }, [fetchLiveData]);

  const evaCfg = EMOTION_CFG[emotion];
  const dogEmo: Emotion = activeSpeaker === 'dog' ? emotion : 'serious';
  const dogCfg = EMOTION_CFG[dogEmo];

  return (
    <div style={{
      width: '100%', maxWidth: 900, margin: '0 auto',
      fontFamily: 'var(--font-sans, Inter, sans-serif)',
    }}>
      {/* ── Studio Card ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', borderRadius: 28, overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(8,8,24,0.98) 0%, rgba(4,4,16,1) 100%)',
        border: `1px solid ${evaCfg.color}30`,
        boxShadow: `0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px ${evaCfg.color}15, 0 0 60px ${evaCfg.glow}`,
        transition: 'border-color 0.5s, box-shadow 0.5s',
      }}>
        {/* Grid bg */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(${evaCfg.color}06 1px, transparent 1px), linear-gradient(90deg, ${evaCfg.color}06 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />
        {/* Scan line */}
        <motion.div
          animate={{ y: ['-10%', '110%'] }}
          transition={{ repeat: Infinity, duration: 7, ease: 'linear', repeatDelay: 2 }}
          style={{
            position: 'absolute', left: 0, right: 0, height: 1, zIndex: 1, pointerEvents: 'none',
            background: `linear-gradient(90deg, transparent, ${evaCfg.color}50, transparent)`,
          }}
        />

        {/* ── Header bar ──────────────────────────────────────────── */}
        <div style={{
          padding: '14px 24px',
          borderBottom: `1px solid ${evaCfg.color}18`,
          display: 'flex', alignItems: 'center', gap: 12,
          background: `linear-gradient(90deg, rgba(0,0,0,0.4), ${evaCfg.color}05)`,
        }}>
          {/* Studio dots */}
          <div style={{ display: 'flex', gap: 5 }}>
            {['#ff5f57', '#ffbd2e', '#28c840'].map((c, i) => (
              <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}80` }} />
            ))}
          </div>
          <Radio size={11} color={evaCfg.color} />
          <span style={{ fontSize: 9, fontWeight: 900, color: evaCfg.color, letterSpacing: '0.2em', fontFamily: 'monospace' }}>
            SoSo SMRE PODCAST STUDIO — EPISODE {episodeNum}
          </span>
          <motion.div
            animate={{ opacity: isRunning ? [1, 0.3, 1] : 0.3 }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            style={{
              padding: '2px 9px', borderRadius: 99, fontSize: 8, fontWeight: 900, letterSpacing: '0.1em',
              background: isRunning ? evaCfg.color : 'transparent',
              color: isRunning ? '#000' : evaCfg.color,
              border: `1px solid ${evaCfg.color}`,
            }}
          >
            {isRunning ? '◉ LIVE ON AIR' : '○ STANDBY'}
          </motion.div>

          <div style={{ flex: 1 }} />

          {/* Mute toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsMuted(m => !m)}
            style={{
              background: isMuted ? 'rgba(244,63,94,0.15)' : `${evaCfg.color}12`,
              border: `1px solid ${isMuted ? '#f43f5e40' : evaCfg.color + '30'}`,
              borderRadius: 8, padding: '5px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              color: isMuted ? '#f43f5e' : evaCfg.color, fontSize: 9, fontWeight: 800,
            }}
          >
            {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            {isMuted ? 'MUTED' : 'SOUND ON'}
          </motion.button>
        </div>

        {/* ── Emotion selector ────────────────────────────────────── */}
        <div style={{ padding: '12px 24px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: 900, letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>MOOD</span>
          <EmotionPills current={emotion} onChange={setEmotion} />
          <div style={{ flex: 1 }} />
          {/* Live ticker */}
          {marketData?.btc && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {[
                { sym: 'BTC', val: marketData.btc },
                { sym: 'ETH', val: marketData.eth },
                { sym: 'SOSO', val: marketData.soso },
              ].map(t => t.val ? (
                <div key={t.sym} style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', fontWeight: 800 }}>{t.sym}</div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: evaCfg.color, fontFamily: 'monospace' }}>
                    ${Number(t.val).toLocaleString(undefined, { minimumFractionDigits: t.sym === 'SOSO' ? 4 : 0, maximumFractionDigits: t.sym === 'SOSO' ? 4 : 0 })}
                  </div>
                </div>
              ) : null)}
            </div>
          )}
        </div>

        {/* ── Two hosts row ────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-end', gap: 0, position: 'relative' }}>
          {/* Eva (left) */}
          <HostOrb
            isSpeaking={activeSpeaker === 'eva'}
            emotion={activeSpeaker === 'eva' ? emotion : 'divine'}
            label="EVA"
            tag="Divine AI Analyst"
            side="left"
          />

          {/* Center mic / controls */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingBottom: 8 }}>
            {/* Podcast mic icon */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: `radial-gradient(circle, ${evaCfg.color}25, transparent)`,
              border: `2px solid ${evaCfg.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isRunning ? `0 0 30px ${evaCfg.glow}` : 'none',
              transition: 'box-shadow 0.5s',
            }}>
              <Mic size={20} color={evaCfg.color} />
            </div>

            {/* vs divider */}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 900, letterSpacing: '0.15em' }}>vs</div>

            {/* Status */}
            {isLoading && (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1 }}
                style={{ fontSize: 9, color: evaCfg.color, fontWeight: 800, letterSpacing: '0.1em' }}
              >
                LOADING LIVE DATA…
              </motion.div>
            )}

            {isRunning && !isLoading && activeSpeaker && (
              <div style={{ fontSize: 9, color: evaCfg.color, fontWeight: 800, letterSpacing: '0.1em' }}>
                {activeSpeaker === 'eva' ? 'EVA IS SPEAKING…' : 'SODOGGY IS SPEAKING…'}
              </div>
            )}
          </div>

          {/* SoDoggy (right) */}
          <HostOrb
            isSpeaking={activeSpeaker === 'dog'}
            emotion={activeSpeaker === 'dog' ? emotion : 'serious'}
            label="SODOGGY"
            tag="Alpha Hunter AI"
            side="right"
          />
        </div>

        {/* ── Control buttons ──────────────────────────────────────── */}
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 12, justifyContent: 'center' }}>
          {!isRunning ? (
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: `0 16px 40px ${evaCfg.glow}` }}
              whileTap={{ scale: 0.96 }}
              onClick={startPodcast}
              disabled={isLoading}
              style={{
                background: `linear-gradient(135deg, ${evaCfg.color}, ${evaCfg.color}bb)`,
                color: '#000', border: 'none', padding: '13px 36px', borderRadius: 14,
                fontSize: 12, fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: `0 8px 28px ${evaCfg.glow}`, letterSpacing: '0.08em',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading
                ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}><RefreshCw size={14} /></motion.div>
                : <Radio size={14} />
              }
              {isLoading ? 'LOADING LIVE DATA…' : '▶ START PODCAST'}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={stopPodcast}
              style={{
                background: 'linear-gradient(135deg,#f43f5e,#be123c)',
                color: '#fff', border: 'none', padding: '13px 36px', borderRadius: 14,
                fontSize: 12, fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 8px 28px rgba(244,63,94,0.4)', letterSpacing: '0.08em',
              }}
            >
              <Square size={14} fill="#fff" /> STOP BROADCAST
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={fetchLiveData}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)', padding: '13px 18px', borderRadius: 14,
              fontSize: 11, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} /> REFRESH DATA
          </motion.button>
        </div>

        {/* ── Live news ticker ─────────────────────────────────────── */}
        {newsData.length > 0 && (
          <div style={{
            borderTop: `1px solid ${evaCfg.color}12`,
            padding: '10px 24px',
            display: 'flex', gap: 8, alignItems: 'center',
            background: 'rgba(0,0,0,0.3)',
          }}>
            <Newspaper size={10} color={evaCfg.color} />
            <span style={{ fontSize: 8, fontWeight: 900, color: evaCfg.color, letterSpacing: '0.15em', flexShrink: 0 }}>LIVE NEWS</span>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <motion.div
                animate={{ x: ['100%', '-120%'] }}
                transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
                style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}
              >
                {newsData.map((n, i) => (
                  <span key={i}>◆ {n.title}</span>
                ))}
              </motion.div>
            </div>
          </div>
        )}

        {/* ── Transcript panel ─────────────────────────────────────── */}
        {transcript.length > 0 && (
          <div style={{ borderTop: `1px solid ${evaCfg.color}12` }}>
            {/* Panel header */}
            <div style={{
              padding: '10px 24px',
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,0,0,0.2)',
            }}>
              <Activity size={10} color={evaCfg.color} />
              <span style={{ fontSize: 8, fontWeight: 900, color: evaCfg.color, letterSpacing: '0.18em' }}>LIVE TRANSCRIPT</span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{transcript.length} lines</span>
            </div>
            {/* Messages */}
            <div style={{
              padding: '12px 24px 20px',
              maxHeight: 320, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              {transcript.map((line, i) => (
                <TranscriptLine
                  key={i}
                  line={line}
                  evaColor={EMOTION_CFG['divine'].color}
                  dogColor={EMOTION_CFG['joy'].color}
                />
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {transcript.length === 0 && !isLoading && (
          <div style={{
            padding: '24px', textAlign: 'center',
            borderTop: `1px solid ${evaCfg.color}10`,
          }}>
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}
            >
              Hit <span style={{ color: evaCfg.color }}>▶ START PODCAST</span> — Eva &amp; SoDoggy will discuss live crypto markets together
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
