'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { type Emotion, type ScriptLine, type EvaState } from './types';

const TOPICS = [
  'Today\'s Crypto Market Analysis',
  'Bitcoin Dominance & Alt Season',
  'DeFi Yield Opportunities',
  'SoSoValue ETF Flow Insights',
  'Macro Market Impact on Crypto',
  'Top Gainers & Losers Breakdown',
];

function pickVoice(voices: SpeechSynthesisVoice[], prefer: 'female' | 'male'): SpeechSynthesisVoice | null {
  const femaleNames = ['Samantha', 'Karen', 'Victoria', 'Google UK English Female', 'Microsoft Zira', 'Alice'];
  const maleNames   = ['Daniel', 'Alex', 'Google UK English Male', 'Microsoft David', 'Fred'];
  const names = prefer === 'female' ? femaleNames : maleNames;
  for (const name of names) {
    const v = voices.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
    if (v) return v;
  }
  return voices[0] ?? null;
}

interface UseEvaStateReturn extends EvaState {
  topics: string[];
  setTopic: (t: string) => void;
  setEmotion: (e: Emotion) => void;
  toggleMute: () => void;
  generateScript: () => Promise<void>;
  play: () => void;
  stop: () => void;
  skipLine: () => void;
}

/**
 * useEvaState — All SoEva business logic in a single custom hook.
 * Handles script generation, TTS playback, voice selection, and state.
 */
export function useEvaState(): UseEvaStateReturn {
  const [state, setState] = useState<EvaState>({
    playing: false,
    lineIndex: 0,
    emotion: 'divine',
    muted: false,
    speakingHost: null,
    topic: TOPICS[0],
    script: [],
    isGenerating: false,
    error: null,
  });

  const voicesRef     = useRef<SpeechSynthesisVoice[]>([]);
  const evaVoiceRef   = useRef<SpeechSynthesisVoice | null>(null);
  const echoVoiceRef  = useRef<SpeechSynthesisVoice | null>(null);
  const playingRef    = useRef(false);
  const lineIndexRef  = useRef(0);
  const scriptRef     = useRef<ScriptLine[]>([]);
  const mutedRef      = useRef(false);

  // Load voices
  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length === 0) return;
      voicesRef.current   = v;
      evaVoiceRef.current  = pickVoice(v, 'female');
      echoVoiceRef.current = pickVoice(v, 'male');
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  const speakLine = useCallback((line: ScriptLine, onEnd: () => void) => {
    window.speechSynthesis.cancel();
    if (mutedRef.current) { setTimeout(onEnd, 1200); return; }

    const utt = new SpeechSynthesisUtterance(line.text);
    utt.voice  = line.host === 'eva' ? evaVoiceRef.current! : echoVoiceRef.current!;
    utt.pitch  = line.host === 'eva' ? 1.1 : 0.9;
    utt.rate   = 0.95;
    utt.volume = 1;
    utt.onstart = () => setState((s) => ({ ...s, speakingHost: line.host }));
    utt.onend   = () => { setState((s) => ({ ...s, speakingHost: null })); onEnd(); };
    utt.onerror = () => { setState((s) => ({ ...s, speakingHost: null })); onEnd(); };
    window.speechSynthesis.speak(utt);
  }, []);

  const playFromLine = useCallback((idx: number) => {
    const script = scriptRef.current;
    if (!playingRef.current || idx >= script.length) {
      playingRef.current = false;
      setState((s) => ({ ...s, playing: false, speakingHost: null, lineIndex: 0 }));
      return;
    }
    lineIndexRef.current = idx;
    setState((s) => ({ ...s, lineIndex: idx }));
    speakLine(script[idx], () => {
      if (playingRef.current) playFromLine(idx + 1);
    });
  }, [speakLine]);

  const play = useCallback(() => {
    if (scriptRef.current.length === 0) return;
    playingRef.current = true;
    setState((s) => ({ ...s, playing: true }));
    playFromLine(lineIndexRef.current);
  }, [playFromLine]);

  const stop = useCallback(() => {
    playingRef.current = false;
    window.speechSynthesis.cancel();
    setState((s) => ({ ...s, playing: false, speakingHost: null }));
  }, []);

  const skipLine = useCallback(() => {
    if (!playingRef.current) return;
    window.speechSynthesis.cancel();
    playFromLine(lineIndexRef.current + 1);
  }, [playFromLine]);

  const generateScript = useCallback(async () => {
    stop();
    setState((s) => ({ ...s, isGenerating: true, error: null, script: [], lineIndex: 0 }));
    lineIndexRef.current = 0;

    try {
      const [pricesRes, newsRes] = await Promise.allSettled([
        fetch('/api/prices').then((r) => r.json()),
        fetch('/api/news').then((r) => r.json()),
      ]);
      const prices = pricesRes.status === 'fulfilled' ? pricesRes.value : {};
      const news   = newsRes.status === 'fulfilled' ? newsRes.value?.news?.slice(0, 5) : [];

      const res = await fetch('/api/dog-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: state.topic,
          prices,
          news,
          context: `You are writing a dual-host financial podcast script. Host 1 is "EVA" (analytical, calm). Host 2 is "ECHO" (energetic, bullish). Write exactly 8 lines alternating between EVA and ECHO about: "${state.topic}". Format each line as: "EVA: [text]" or "ECHO: [text]". Keep each line under 30 words. Be specific with numbers.`,
        }),
      });
      const data = await res.json();
      const raw: string = data.reply ?? '';

      const lines: ScriptLine[] = raw
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.startsWith('EVA:') || l.startsWith('ECHO:'))
        .map((l: string): ScriptLine => ({
          host: l.startsWith('EVA:') ? 'eva' : 'echo',
          text: l.replace(/^(EVA|ECHO):\s*/, '').trim(),
        }));

      scriptRef.current = lines;
      setState((s) => ({ ...s, isGenerating: false, script: lines }));
    } catch (e) {
      setState((s) => ({ ...s, isGenerating: false, error: (e as Error).message }));
    }
  }, [state.topic, stop]);

  const setTopic   = (t: string)   => setState((s) => ({ ...s, topic: t }));
  const setEmotion = (e: Emotion)  => setState((s) => ({ ...s, emotion: e }));
  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setState((s) => ({ ...s, muted: !s.muted }));
  };

  return { ...state, topics: TOPICS, setTopic, setEmotion, toggleMute, generateScript, play, stop, skipLine };
}
