"use client";

import { useState, useEffect, useRef } from "react";
import {
  waitForVoices,
  pickScoobyVoice,
  SCOOBY_EMOTION,
  SCOOBY_INTROS,
  scoobyfy,
  speakChunked,
  logAllVoices,
} from "./voiceEngine";

export default function useSpeech() {
  const [speaking, setSpeaking]       = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // ── Load & lock best Scooby voice on mount ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    waitForVoices().then(voices => {
      logAllVoices(); // shows available voices in browser console
      voiceRef.current = pickScoobyVoice(voices);
      setVoicesReady(true);
    });
  }, []);

  const cancel = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const speak = (text: string, emotion = "neutral") => {
    if (typeof window === "undefined") return;

    const preset  = SCOOBY_EMOTION[emotion]  ?? SCOOBY_EMOTION.neutral;
    const intro   = SCOOBY_INTROS[emotion]   ?? "";
    const transformed = intro + scoobyfy(text);

    // Ensure voice is loaded
    const doSpeak = (voice: SpeechSynthesisVoice | null) => {
      speakChunked(
        transformed,
        voice,
        preset.pitch,
        preset.rate,
        true,                        // wave effect ON for Scooby
        () => setSpeaking(true),
        () => setSpeaking(false),
      );
    };

    if (voiceRef.current) {
      doSpeak(voiceRef.current);
    } else {
      waitForVoices().then(voices => {
        const v = pickScoobyVoice(voices);
        voiceRef.current = v;
        doSpeak(v);
      });
    }
  };

  return { speak, speaking, cancel, voicesReady };
}
