/**
 * Free in-browser voice stack (no paid APIs).
 * TTS: Kokoro-82M → Piper → Web Speech
 * STT: Whisper tiny (transformers.js) → Web Speech
 * Models lazy-load on voice-mode open. Never throw raw engine strings to UI.
 */

import type { VoiceLang } from '@/lib/voice-answer';

export type VoiceEngineState = 'idle' | 'loading' | 'listening' | 'thinking' | 'speaking';
export type LoadProgress = { phase: string; loaded: number; total: number; pct: number; label?: string };

export type TtsEngineId = 'kokoro' | 'piper' | 'webspeech';
export type SttEngineId = 'whisper' | 'webspeech';

type ProgressCb = (p: LoadProgress) => void;

const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const WHISPER_MODEL = 'Xenova/whisper-tiny';

const KOKORO_LANGS = new Set(['en-US', 'auto']);

const PIPER_VOICES: Partial<Record<Exclude<VoiceLang, 'auto'>, string>> = {
  'hi-IN': 'hi_IN-priyamvada-medium',
  'es-ES': 'es_ES-sharvard-medium',
  'fr-FR': 'fr_FR-siwis-medium',
  'pt-BR': 'pt_BR-faber-medium',
  'it-IT': 'it_IT-paola-medium',
};

type KokoroLike = {
  generate: (text: string, opts: { voice: string }) => Promise<{
    audio?: Float32Array;
    data?: Float32Array;
    sampling_rate?: number;
    sampleRate?: number;
  }>;
};

let kokoroInstance: KokoroLike | null = null;
let whisperPipeline: ((audio: Float32Array, opts?: Record<string, unknown>) => Promise<{ text: string }>) | null =
  null;
let loadPromise: Promise<{ tts: TtsEngineId | 'none'; stt: SttEngineId | 'none' }> | null = null;
let lastCapabilities: { tts: TtsEngineId | 'none'; stt: SttEngineId | 'none' } = {
  tts: 'none',
  stt: 'none',
};

function pct(loaded: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((loaded / total) * 100));
}

function progressFromUnknown(p: unknown, phase: string, label: string): LoadProgress {
  const info = (p ?? {}) as { loaded?: number; total?: number; status?: string; progress?: number };
  if (typeof info.progress === 'number' && info.progress > 0 && info.progress <= 1) {
    return { phase, loaded: info.progress * 100, total: 100, pct: Math.round(info.progress * 100), label };
  }
  const loaded = info.loaded ?? 0;
  const total = info.total && info.total > 0 ? info.total : loaded > 0 ? loaded : 100;
  // Avoid stuck 0% while "download" status with no bytes yet
  const base = info.status === 'initiate' || info.status === 'download' ? Math.max(2, pct(loaded, total)) : pct(loaded, total);
  return { phase, loaded, total, pct: base || (info.status ? 3 : 0), label };
}

export function prefersKokoro(lang: VoiceLang): boolean {
  return KOKORO_LANGS.has(lang === 'auto' ? 'en-US' : lang);
}

export function piperVoiceFor(lang: VoiceLang): string | null {
  if (lang === 'auto') return null;
  return PIPER_VOICES[lang] ?? null;
}

export function getVoiceCapabilities() {
  return lastCapabilities;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function preferWasm(): boolean {
  if (typeof navigator === 'undefined') return true;
  // Headless / no WebGPU → wasm
  if (!('gpu' in navigator)) return true;
  const ua = navigator.userAgent || '';
  if (/HeadlessChrome/i.test(ua)) return true;
  return false;
}

/** Lazy-load Kokoro + Whisper. Soft-fail to Web Speech. */
export async function ensureVoiceModels(
  onProgress?: ProgressCb,
): Promise<{ tts: TtsEngineId | 'none'; stt: SttEngineId | 'none' }> {
  if (kokoroInstance || whisperPipeline) {
    lastCapabilities = {
      tts: kokoroInstance ? 'kokoro' : 'webspeech',
      stt: whisperPipeline ? 'whisper' : 'webspeech',
    };
    return lastCapabilities;
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    let ttsCap: TtsEngineId | 'none' = 'webspeech';
    let sttCap: SttEngineId | 'none' = 'webspeech';
    const useWasm = preferWasm();

    onProgress?.({ phase: 'kokoro', loaded: 0, total: 100, pct: 2, label: 'Preparing natural voice…' });
    try {
      const { KokoroTTS } = await import('kokoro-js');
      const device = useWasm ? 'wasm' : 'webgpu';
      const dtype = device === 'webgpu' ? 'fp32' : 'q8';
      const tts = await withTimeout(
        KokoroTTS.from_pretrained(KOKORO_MODEL, {
          dtype,
          device,
          progress_callback: (p: unknown) => {
            onProgress?.(progressFromUnknown(p, 'kokoro', 'Downloading Kokoro voice…'));
          },
        } as never),
        120_000,
        'Kokoro',
      );
      kokoroInstance = tts as KokoroLike;
      // Smoke: tiny generate
      const probe = await withTimeout(
        kokoroInstance.generate('Ready.', { voice: 'af_heart' }),
        60_000,
        'Kokoro probe',
      );
      const audio = probe.audio ?? probe.data;
      if (audio && audio.length > 100) {
        let energy = 0;
        const step = Math.max(1, Math.floor(audio.length / 2000));
        for (let i = 0; i < audio.length; i += step) energy += Math.abs(audio[i]);
        if (energy > 0.01) ttsCap = 'kokoro';
        else {
          console.warn('[voice] Kokoro probe silent - falling back');
          kokoroInstance = null;
        }
      } else {
        kokoroInstance = null;
      }
    } catch (e) {
      console.warn('[voice] Kokoro unavailable', e);
      kokoroInstance = null;
    }

    onProgress?.({ phase: 'whisper', loaded: 0, total: 100, pct: 2, label: 'Preparing speech recognition…' });
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      // Prefer wasm unless WebGPU clearly available (avoids hung 0% in many envs)
      const device = useWasm ? 'wasm' : 'webgpu';
      const asr = await withTimeout(
        pipeline('automatic-speech-recognition', WHISPER_MODEL, {
          device,
          dtype: 'q8',
          progress_callback: (p: unknown) => {
            onProgress?.(progressFromUnknown(p, 'whisper', 'Downloading Whisper…'));
          },
        }),
        180_000,
        'Whisper',
      );
      whisperPipeline = asr as unknown as typeof whisperPipeline;
      sttCap = 'whisper';
    } catch (e) {
      console.warn('[voice] Whisper unavailable', e);
      whisperPipeline = null;
      sttCap = getSpeechRecognition() ? 'webspeech' : 'none';
    }

    if (!kokoroInstance) ttsCap = typeof window !== 'undefined' && window.speechSynthesis ? 'webspeech' : 'none';

    onProgress?.({ phase: 'ready', loaded: 100, total: 100, pct: 100, label: 'Voice ready' });
    lastCapabilities = { tts: ttsCap, stt: sttCap };
    return lastCapabilities;
  })().catch((e) => {
    console.warn('[voice] ensureVoiceModels failed', e);
    loadPromise = null;
    lastCapabilities = {
      tts: typeof window !== 'undefined' && window.speechSynthesis ? 'webspeech' : 'none',
      stt: getSpeechRecognition() ? 'webspeech' : 'none',
    };
    return lastCapabilities;
  });

  return loadPromise;
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
    src.connect(analyser);
    analyser.connect(ctx.destination);
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
    void ctx.resume().then(() => src.start());
    setTimeout(finish, (audio.length / sampleRate) * 1000 + 2500);
  });
}

async function speakKokoro(text: string, onLevel?: (n: number) => void): Promise<TtsEngineId> {
  if (!kokoroInstance) throw new Error('kokoro missing');
  const result = await kokoroInstance.generate(text, { voice: 'af_heart' });
  const audio = result.audio ?? result.data;
  const sr = result.sampling_rate ?? result.sampleRate ?? 24000;
  if (!audio || audio.length < 32) throw new Error('empty audio');
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
  await tts.download(voiceId, (progress: { loaded?: number; total?: number }) => {
    onProgress?.(
      progressFromUnknown(progress, `piper`, 'Downloading language voice…'),
    );
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
      reject(new Error('speech unavailable'));
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.02;
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
      reject(new Error('speech unavailable'));
    };
    window.speechSynthesis.speak(u);
  });
}

/** Friendly speak - never throws engine jargon. Returns engine used or null if silent skip. */
export async function speakText(opts: {
  text: string;
  lang: VoiceLang;
  speechLang: string;
  onProgress?: ProgressCb;
  onLevel?: (n: number) => void;
}): Promise<TtsEngineId | null> {
  const { text, lang, speechLang, onProgress, onLevel } = opts;
  if (!text.trim()) return null;

  if (prefersKokoro(lang) && kokoroInstance) {
    try {
      return await speakKokoro(text, onLevel);
    } catch (e) {
      console.warn('[voice] Kokoro speak failed', e);
    }
  }

  const piperId = piperVoiceFor(lang === 'auto' ? 'en-US' : lang);
  if (piperId) {
    try {
      return await speakPiper(text, piperId, onProgress, onLevel);
    } catch (e) {
      console.warn('[voice] Piper speak failed', e);
    }
  }

  if (kokoroInstance && /^[\x00-\x7F\s\p{P}]+$/u.test(text) && text.length < 800) {
    try {
      return await speakKokoro(text, onLevel);
    } catch {
      /* fall through */
    }
  }

  try {
    return await speakWebSpeech(text, speechLang, onLevel);
  } catch (e) {
    console.warn('[voice] Web Speech TTS failed', e);
    return null;
  }
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

/** Map internal failures to user-safe copy (never engine stack traces). */
export function friendlyVoiceMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const t = raw.toLowerCase();
  if (t.includes('not-allowed') || t.includes('permission')) {
    return 'Microphone permission is off. Allow mic access, or type your question below.';
  }
  if (
    t.includes('speech') ||
    t.includes('webspeech') ||
    t.includes('recognition') ||
    t.includes('websocket') ||
    t.includes('no-speech')
  ) {
    return 'Live listening is limited in this browser. Type a question, or try Chrome/Edge.';
  }
  if (
    t.includes('kokoro') ||
    t.includes('piper') ||
    t.includes('whisper') ||
    t.includes('onnx') ||
    t.includes('worker') ||
    t.includes('wasm') ||
    t.includes('timed out') ||
    t.includes('transformers')
  ) {
    return 'Local voice models are still warming up. You can type a question anytime.';
  }
  if (t.includes('network') || t.includes('fetch') || t.includes('cdn') || t.includes('cors')) {
    return 'Could not download voice models yet. Check your connection. Typing still works.';
  }
  // Never surface raw engine text
  return 'Something went wrong with voice. Typing still works, and voice never places orders.';
}
