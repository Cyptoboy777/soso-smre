/**
 * Headless Chromium probe: Kokoro TTS non-silent wav + Whisper STT on a synthetic wav.
 * Writes /tmp/flowsentinel-voice-verify.json and optionally /tmp/kokoro-probe.wav
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outJson = '/tmp/flowsentinel-voice-verify.json';
const outWav = '/tmp/kokoro-probe.wav';

function floatToWav(float32, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = float32.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    buf.writeInt16LE((s * 0x7fff) | 0, 44 + i * 2);
  }
  return buf;
}

const html = `<!doctype html><html><body>
<script type="module">
window.__voiceProbe = async () => {
  const result = { tts: { ok: false }, stt: { ok: false }, notes: [] };
  try {
    const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
    result.notes.push('kokoro import ok');
    const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
    });
    result.notes.push('kokoro loaded');
    const out = await tts.generate('FlowSentinel voice check.', { voice: 'af_heart' });
    const audio = out.audio || out.data;
    const sr = out.sampling_rate || out.sampleRate || 24000;
    if (!audio || !audio.length) throw new Error('empty audio');
    let energy = 0;
    const step = Math.max(1, Math.floor(audio.length / 4000));
    for (let i = 0; i < audio.length; i += step) energy += Math.abs(audio[i]);
    result.tts = {
      ok: energy > 0.01,
      length: audio.length,
      sampleRate: sr,
      energy,
      silent: energy <= 0.01,
    };
    window.__kokoroAudio = { audio: Array.from(audio), sampleRate: sr };
    result.notes.push('kokoro generate ok energy=' + energy.toFixed(4));
  } catch (e) {
    result.tts = { ok: false, error: String(e && e.message || e).slice(0, 240) };
    result.notes.push('kokoro fail: ' + result.tts.error);
  }

  try {
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    result.notes.push('transformers import ok');
    const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      device: 'wasm',
      dtype: 'q8',
    });
    result.notes.push('whisper loaded');
    // 1s 440Hz tone at 16kHz as stand-in (Whisper may return empty for pure tone — also try silence-with-noise)
    const sr = 16000;
    const samples = new Float32Array(sr);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / sr) * 0.2 + (Math.random() - 0.5) * 0.01;
    }
    const out = await asr(samples, { sampling_rate: sr, return_timestamps: false });
    const text = (out && out.text) ? String(out.text).trim() : '';
    result.stt = { ok: true, text, loaded: true };
    result.notes.push('whisper ran text=' + JSON.stringify(text).slice(0, 80));
  } catch (e) {
    result.stt = { ok: false, error: String(e && e.message || e).slice(0, 240) };
    result.notes.push('whisper fail: ' + result.stt.error);
  }
  return result;
};
</script></body></html>`;

// Minimal static server so we have an origin (CDN ESM still used)
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-features=SharedArrayBuffer'],
});
const page = await browser.newPage();
page.setDefaultTimeout(300_000);
const consoleLogs = [];
page.on('console', (m) => consoleLogs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => consoleLogs.push('pageerror: ' + e.message));

await page.goto(url, { waitUntil: 'domcontentloaded' });
console.log('Running voice probe (may take several minutes for model download)…');
const result = await page.evaluate(async () => {
  return await window.__voiceProbe();
});
if (result.tts?.ok) {
  const payload = await page.evaluate(() => window.__kokoroAudio);
  if (payload?.audio) {
    const wav = floatToWav(Float32Array.from(payload.audio), payload.sampleRate || 24000);
    fs.writeFileSync(outWav, wav);
    result.tts.wavBytes = wav.length;
    result.tts.wavPath = outWav;
  }
}
result.consoleTail = consoleLogs.slice(-30);
fs.writeFileSync(outJson, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
server.close();
process.exit(result.tts?.ok || result.stt?.ok ? 0 : 2);
