/**
 * Free in-browser voice stack (no paid APIs).
 * TTS: Kokoro-82M (kokoro-js, Apache-2.0) → Piper (@mintplex-labs/piper-tts-web, MIT) → Web Speech
 * STT: Whisper tiny via @huggingface/transformers → Web Speech
 * Models lazy-load on first voice-mode open; progress reported; Cache Storage / OPFS when available.
 */

import type { VoiceLang } from '@/lib/voice-answer';

export type VoiceEngineState = 'idle' | 'loading' | 'listening' | 'thinking' | 'speaking';
export type LoadProgress = { phase: string; loaded: number; total: number; pct: number };

export type TtsEngineId = 'kokoro' | 'piper' | 'webspeech';
export type SttEngineId = 'whisper' | 'webspeech';

type ProgressCb = (p: LoadProgress) => void;

const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const WHISPER_MODEL = 'Xenova/whisper-tiny'; // multilingual

/** Languages Kokoro English voices handle well (spoken in EN voice for Romance if needed — we prefer Piper/WebSpeech for non-EN). */
const KOKORO_LANGS = new Set(['en-US', 'auto']);

/** Piper voice ids (Rhasspy, MIT) for Indic / when Kokoro is weak. */
const PIPER_VOICES: Partial<Record<Exclude<VoiceLang, 'auto'>, string>> = {
  'hi-IN': 'hi_IN-priyamvada-medium',
  'es-ES': 'es_ES-sharvard-medium',
  'fr-FR': 'fr_FR-siwis-medium',
  'pt-BR': 'pt_BR-faber-medium',
  'it-IT': 'it_IT-paola-medium',
  // zh/ja/ko often better via Web Speech on device; Piper may lack high-quality ids in the web package
};

let kokoroInstance: { generate: (text: string, opts: { voice: string }) => Promise<{ audio: Float32Array; sampling_rate: number }> } | null = null;
let whisperPipeline: ((audio: Float32Array | Float32Array[], opts?: Record<string, unknown>) => Promise<{ text: string }>) | null = null;
let loadPromise: Promise<void> | null = null;

function pct(loaded: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((loaded / total) * 100));
}

export function prefersKokoro(lang: VoiceLang): boolean {
  return KOKORO_LANGS.has(lang === 'auto' ? 'en-US' : lang);
}

export function piperVoiceFor(lang: VoiceLang): string | null {
  if (lang === 'auto') return null;
  return PIPER_VOICES[lang] ?? null;
}

/** Lazy-load Kokoro + Whisper. Piper downloads per-voice on first use. */
export async function ensureVoiceModels(onProgress?: ProgressCb): Promise<void> {
  if (kokoroInstance && whisperPipeline) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    onProgress?.({ phase: 'kokoro', loaded: 0, total: 100, pct: 0 });
    try {
      const { KokoroTTS } = await import('kokoro-js');
      const device =
        typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm';
      const dtype = device === 'webgpu' ? 'fp32' : 'q8';
      const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL, {
        dtype,
        device,
        progress_callback: (p: unknown) => {
          const info = p as { loaded?: number; total?: number };
          const loaded = info.loaded ?? 0;
          const total = info.total ?? 1;
          onProgress?.({
            phase: 'kokoro',
            loaded,
            total,
            pct: pct(loaded, total),
          });
        },
      } as never);
      kokoroInstance = tts as typeof kokoroInstance;
    } catch (e) {
      console.warn('[voice] Kokoro load failed — will use Piper/Web Speech', e);
      kokoroInstance = null;
    }

    onProgress?.({ phase: 'whisper', loaded: 0, total: 100, pct: 0 });
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Prefer browser cache
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      const device =
        typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm';
      whisperPipeline = (await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        device,
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        progress_callback: (p: unknown) => {
          const info = p as { loaded?: number; total?: number };
          const loaded = info.loaded ?? 0;
          const total = info.total ?? 1;
          onProgress?.({
            phase: 'whisper',
            loaded,
            total,
            pct: pct(loaded, total),
          });
        },
      })) as typeof whisperPipeline;
    } catch (e) {
      console.warn('[voice] Whisper load failed — will use Web Speech STT', e);
      whisperPipeline = null;
    }
    onProgress?.({ phase: 'ready', loaded: 100, total: 100, pct: 100 });
  })();
  try {
    await loadPromise;
  } finally {
    /* keep singleton */
  }
}

function playFloat32(audio: Float32Array, sampleRate: number, onLevel?: (n: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const ctx = new AudioContext();
    const buffer = ctx.createBuffer(1, audio.length, sampleRate);
    buffer.copyToChannel(audio as Float32Array<ArrayBuffer>, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const gain = ctx.createGain();
    src.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      onLevel?.(0);
      void ctx.close();
      resolve();
    };
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      onLevel?.(Math.min(1, Math.sqrt(sum / data.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    src.onended = finish;
    src.start();
    setTimeout(finish, (audio.length / sampleRate) * 1000 + 2500);
  });
}

async function speakKokoro(text: string, onLevel?: (n: number) => void): Promise<TtsEngineId> {
  if (!kokoroInstance) throw new Error('kokoro missing');
  const result = await kokoroInstance.generate(text, { voice: 'af_heart' });
  // kokoro-js RawAudio: .audio + .sampling_rate OR toWav/save
  const audio =
    (result as { audio?: Float32Array }).audio ??
    (result as { data?: Float32Array }).data;
  const sr =
    (result as { sampling_rate?: number }).sampling_rate ??
    (result as { sampleRate?: number }).sampleRate ??
    24000;
  if (!audio) throw new Error('kokoro empty audio');
  await playFloat32(audio instanceof Float32Array ? audio : new Float32Array(audio as ArrayLike<number>), sr, onLevel);
  return 'kokoro';
}

async function speakPiper(
  text: string,
  voiceId: string,
  onProgress?: ProgressCb,
  onLevel?: (n: number) => void,
): Promise<TtsEngineId> {
  const tts = await import('@mintplex-labs/piper-tts-web');
  await tts.download(voiceId, (progress: { loaded?: number; total?: number; url?: string }) => {
    const loaded = progress.loaded ?? 0;
    const total = progress.total ?? 1;
    onProgress?.({
      phase: `piper:${voiceId}`,
      loaded,
      total,
      pct: pct(loaded, total),
    });
  });
  const wav = await tts.predict({ text, voiceId });
  const url = URL.createObjectURL(wav);
  try {
    await playUrl(url, onLevel);
  } finally {
    URL.revokeObjectURL(url);
  }
  return 'piper';
}

function playUrl(url: string, onLevel?: (n: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      onLevel?.(Math.min(1, Math.sqrt(sum / data.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    audio.onplay = () => {
      void ctx.resume();
      raf = requestAnimationFrame(tick);
    };
    audio.onended = () => {
      cancelAnimationFrame(raf);
      onLevel?.(0);
      void ctx.close();
      resolve();
    };
    audio.onerror = () => {
      cancelAnimationFrame(raf);
      void ctx.close();
      reject(new Error('audio play failed'));
    };
    void audio.play().catch(reject);
  });
}

function speakWebSpeech(text: string, lang: string, onLevel?: (n: number) => void): Promise<TtsEngineId> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('no speechSynthesis'));
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.02;
    // Approximate level pulse while speaking (no Analyser on speechSynthesis)
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      onLevel?.(0.35 + 0.35 * Math.abs(Math.sin(t * 6)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    u.onend = () => {
      cancelAnimationFrame(raf);
      onLevel?.(0);
      resolve('webspeech');
    };
    u.onerror = () => {
      cancelAnimationFrame(raf);
      onLevel?.(0);
      reject(new Error('webspeech error'));
    };
    window.speechSynthesis.speak(u);
  });
}

export async function speakText(opts: {
  text: string;
  lang: VoiceLang;
  speechLang: string;
  onProgress?: ProgressCb;
  onLevel?: (n: number) => void;
}): Promise<TtsEngineId> {
  const { text, lang, speechLang, onProgress, onLevel } = opts;
  if (!text.trim()) return 'webspeech';

  // English → Kokoro
  if (prefersKokoro(lang) && kokoroInstance) {
    try {
      return await speakKokoro(text, onLevel);
    } catch (e) {
      console.warn('[voice] Kokoro speak failed', e);
    }
  }

  // Hindi / Romance → Piper when available
  const piperId = piperVoiceFor(lang === 'auto' ? 'en-US' : lang);
  if (piperId) {
    try {
      return await speakPiper(text, piperId, onProgress, onLevel);
    } catch (e) {
      console.warn('[voice] Piper speak failed', e);
    }
  }

  // Also try Kokoro for short English answers even if lang is auto
  if (kokoroInstance && /^[\x00-\x7F\s\p{P}]+$/u.test(text) && text.length < 800) {
    try {
      return await speakKokoro(text, onLevel);
    } catch {
      /* fall through */
    }
  }

  return speakWebSpeech(text, speechLang, onLevel);
}

export function hasWhisper(): boolean {
  return Boolean(whisperPipeline);
}

export async function transcribeWhisper(
  pcm: Float32Array,
  language?: string,
): Promise<{ text: string; engine: SttEngineId }> {
  if (!whisperPipeline) throw new Error('whisper missing');
  const out = await whisperPipeline(pcm, {
    language: language && language !== 'auto' ? language.split('-')[0] : undefined,
    task: 'transcribe',
  });
  return { text: (out.text || '').trim(), engine: 'whisper' };
}

/** Mic analyser helper for orb level while listening. */
export async function openMicAnalyser(): Promise<{
  stream: MediaStream;
  analyser: AnalyserNode;
  ctx: AudioContext;
  getLevel: () => number;
  stop: () => void;
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  return {
    stream,
    analyser,
    ctx,
    getLevel: () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / data.length) * 5);
    },
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

export type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
