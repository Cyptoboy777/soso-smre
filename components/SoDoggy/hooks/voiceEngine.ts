/**
 * voiceEngine.ts
 * Shared voice loading + selection utility for SoEva (JARVIS) and SoDoggy (Scooby).
 * Handles async voice loading, fallbacks, and pitch/rate character mapping.
 */

// ─────────────────────────────────────────────────────
//  WAIT FOR VOICES (Promise-based, works in all browsers)
// ─────────────────────────────────────────────────────
export function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    // Chrome loads voices async — wait for the event
    const handler = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        window.speechSynthesis.onvoiceschanged = null;
        resolve(v);
      }
    };
    window.speechSynthesis.onvoiceschanged = handler;
    // Hard timeout fallback at 2s
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 2000);
  });
}

// ─────────────────────────────────────────────────────
//  DEBUG: log all voices to console
// ─────────────────────────────────────────────────────
export function logAllVoices() {
  waitForVoices().then(voices => {
    console.group("🎙️ Available Voices:");
    voices.forEach(v => console.log(`  [${v.lang}] ${v.name}`));
    console.groupEnd();
  });
}

// ─────────────────────────────────────────────────────
//  JARVIS VOICE PICKER (SoEva) — deep British male
// ─────────────────────────────────────────────────────
const JARVIS_PRIORITY = [
  "Google UK English Male",
  "Microsoft Ryan",
  "Microsoft Guy",
  "Microsoft David",
  "Daniel",
  "Google US English",   // fallback — still sounds ok
];

export function pickJarvisVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const name of JARVIS_PRIORITY) {
    const found = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
    if (found) { console.log("✅ JARVIS voice:", found.name); return found; }
  }
  // Last resort: any en-GB, or just first voice
  const fallback = voices.find(v => v.lang === "en-GB") ?? voices.find(v => v.lang.startsWith("en")) ?? voices[0];
  console.log("⚠️ JARVIS fallback voice:", fallback?.name);
  return fallback ?? null;
}

export const JARVIS_EMOTION: Record<string, { pitch: number; rate: number }> = {
  divine:  { pitch: 0.75, rate: 0.80 },  // deep calm — most JARVIS-like
  joy:     { pitch: 0.82, rate: 0.87 },  // slightly warmer
  alert:   { pitch: 0.90, rate: 1.00 },  // more urgent
  serious: { pitch: 0.70, rate: 0.76 },  // most measured
};

export const JARVIS_PREFIX: Record<string, string> = {
  divine:  "Of course. ",
  joy:     "Excellent news, sir. ",
  alert:   "Alert. Immediate attention required. ",
  serious: "Understood. Processing now. ",
};

// ─────────────────────────────────────────────────────
//  SCOOBY VOICE PICKER (SoDoggy) — high funny pitch
// ─────────────────────────────────────────────────────
const SCOOBY_PRIORITY = [
  "Google US English",
  "Google UK English Female",  // higher pitch naturally
  "Microsoft Zira",
  "Samantha",
  "Karen",
  "Victoria",
];

export function pickScoobyVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const name of SCOOBY_PRIORITY) {
    const found = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
    if (found) { console.log("🐕 Scooby voice:", found.name); return found; }
  }
  const fallback = voices.find(v => v.lang.startsWith("en")) ?? voices[0];
  console.log("⚠️ Scooby fallback voice:", fallback?.name);
  return fallback ?? null;
}

export const SCOOBY_EMOTION: Record<string, { pitch: number; rate: number }> = {
  excited: { pitch: 1.95, rate: 1.05 },
  happy:   { pitch: 1.75, rate: 0.92 },
  alert:   { pitch: 2.00, rate: 1.10 },
  sad:     { pitch: 1.50, rate: 0.78 },
  neutral: { pitch: 1.65, rate: 0.88 },
  serious: { pitch: 1.55, rate: 0.82 },
};

export const SCOOBY_INTROS: Record<string, string> = {
  excited: "Scooby-Dooby-Doo! ",
  happy:   "Heh heh heh! ",
  alert:   "Ruh-roh, Raggy! ",
  sad:     "Awww... ",
  neutral: "Hm hm! ",
  serious: "Ryes, ryes. Ri see. ",
};

export function scoobyfy(text: string): string {
  return text
    .replace(/\bI'm\b/gi,       "Ri'm")
    .replace(/\bI've\b/gi,      "Ri've")
    .replace(/\bI'll\b/gi,      "Ri'll")
    .replace(/\bI can\b/gi,     "Ri can")
    .replace(/\bI\b/g,          "Ri")
    .replace(/\boh\b/gi,        "roh")
    .replace(/\buh-oh\b/gi,     "ruh-roh")
    .replace(/\bno\b/gi,        "ro")
    .replace(/\byes\b/gi,       "ryes");
}

// ─────────────────────────────────────────────────────
//  CHUNKED SPEAKER — avoids Chrome's 200-char TTS bug
// ─────────────────────────────────────────────────────
export function speakChunked(
  text: string,
  voice: SpeechSynthesisVoice | null,
  pitchBase: number,
  rateBase: number,
  waveEffect: boolean,          // alternate pitch per sentence (Scooby wave)
  onStart: () => void,
  onEnd: () => void,
) {
  const synth = window.speechSynthesis;
  synth.cancel();

  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  let idx = 0;

  const next = () => {
    if (idx >= sentences.length) { onEnd(); return; }
    const chunk = sentences[idx].trim();
    if (!chunk) { idx++; next(); return; }

    const utt = new SpeechSynthesisUtterance(chunk);
    if (voice) utt.voice = voice;

    // Wave effect for Scooby: alternate pitch per sentence
    if (waveEffect) {
      utt.pitch = Math.min(2.0, pitchBase + (idx % 2 === 0 ? 0.20 : -0.15));
      utt.rate  = Math.min(1.5, rateBase  + (idx % 3 === 0 ? 0.08 : -0.05));
    } else {
      // JARVIS: very subtle natural cadence variation
      utt.pitch = pitchBase + (idx % 2 === 0 ? 0.02 : -0.02);
      utt.rate  = rateBase;
    }
    utt.volume = 1.0;

    if (idx === 0) utt.onstart = onStart;
    utt.onend   = () => { idx++; next(); };
    utt.onerror = (e) => { console.warn("Speech error:", e); onEnd(); };

    synth.speak(utt);
    idx++;
  };

  next();
}
