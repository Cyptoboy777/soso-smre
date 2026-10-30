/**
 * Hands-free continuous conversation helpers.
 * Uses @ricky0123/vad-web (Silero VAD, MIT) when available.
 * Voice never places orders.
 */
export type ContinuousHandlers = {
  onSpeechStart?: () => void;
  onSpeechEnd?: (pcm16k: Float32Array) => void | Promise<void>;
  onLevel?: (n: number) => void;
  onError?: (e: unknown) => void;
};

export type ContinuousSession = {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  readonly active: boolean;
};

/** Create a MicVAD session. Falls back to null if unsupported. */
export async function createContinuousVad(
  handlers: ContinuousHandlers,
): Promise<ContinuousSession | null> {
  if (typeof window === 'undefined') return null;
  try {
    const { MicVAD } = await import('@ricky0123/vad-web');
    let active = false;
    const vad = await MicVAD.new({
      startOnLoad: false,
      // CDN assets for worklet + onnx (bundler-friendly defaults)
      onSpeechStart: () => {
        handlers.onSpeechStart?.();
      },
      onSpeechEnd: (audio) => {
        void handlers.onSpeechEnd?.(audio);
      },
      onVADMisfire: () => {
        /* ignore short blips */
      },
      onFrameProcessed: (probs) => {
        // isSpeech ~ 0..1
        const p = typeof probs?.isSpeech === 'number' ? probs.isSpeech : 0;
        handlers.onLevel?.(Math.min(1, Math.max(0, p)));
      },
    });
    return {
      get active() {
        return active;
      },
      start() {
        vad.start();
        active = true;
      },
      pause() {
        vad.pause();
        active = false;
      },
      resume() {
        vad.start();
        active = true;
      },
      destroy() {
        try {
          vad.pause();
          // destroy if available
          const anyVad = vad as unknown as { destroy?: () => void };
          anyVad.destroy?.();
        } catch {
          /* */
        }
        active = false;
      },
    };
  } catch (e) {
    handlers.onError?.(e);
    return null;
  }
}

/** Very light energy VAD fallback when Silero cannot load (no extra model). */
export async function createEnergyVadFallback(
  handlers: ContinuousHandlers,
): Promise<ContinuousSession | null> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  let active = false;
  let speaking = false;
  let silenceMs = 0;
  let buf: number[] = [];
  let raf = 0;
  const sampleRate = ctx.sampleRate;

  const loop = () => {
    if (!active) return;
    analyser.getFloatTimeDomainData(data);
    let energy = 0;
    for (let i = 0; i < data.length; i++) energy += data[i] * data[i];
    energy = Math.sqrt(energy / data.length);
    handlers.onLevel?.(Math.min(1, energy * 8));
    const voiced = energy > 0.02;
    if (voiced) {
      if (!speaking) {
        speaking = true;
        silenceMs = 0;
        buf = [];
        handlers.onSpeechStart?.();
      }
      // downsample roughly toward 16k
      const step = Math.max(1, Math.floor(sampleRate / 16000));
      for (let i = 0; i < data.length; i += step) buf.push(data[i]);
      silenceMs = 0;
    } else if (speaking) {
      silenceMs += (analyser.fftSize / sampleRate) * 1000;
      if (silenceMs > 700 && buf.length > 1600) {
        speaking = false;
        const pcm = Float32Array.from(buf);
        buf = [];
        void handlers.onSpeechEnd?.(pcm);
      }
    }
    raf = requestAnimationFrame(loop);
  };

  return {
    get active() {
      return active;
    },
    start() {
      active = true;
      void ctx.resume();
      raf = requestAnimationFrame(loop);
    },
    pause() {
      active = false;
      cancelAnimationFrame(raf);
    },
    resume() {
      active = true;
      void ctx.resume();
      raf = requestAnimationFrame(loop);
    },
    destroy() {
      active = false;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
