/** Spoken replies for the assistant: browser speech synthesis with a low, flat, robot-like delivery. Nothing leaves the device. */

export const voiceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Plain text a speech engine can read: no markdown, links, emoji or long numbers spelled as symbols. */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, 'a link')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_#>~|]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chrome stops long utterances after ~15s, so speak sentence-sized pieces. */
export function chunks(text: string, max = 200): string[] {
  const out: string[] = [];
  let cur = '';
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if ((cur + ' ' + s).length > max && cur) { out.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
    while (cur.length > max) { const cut = cur.lastIndexOf(' ', max); const at = cut > 40 ? cut : max; out.push(cur.slice(0, at)); cur = cur.slice(at).trim(); }
  }
  if (cur) out.push(cur);
  return out;
}

let voicePick: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (voicePick) return voicePick;
  const all = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  if (!all.length) return null;
  const score = (v: SpeechSynthesisVoice) => (/google uk english male|daniel|david|alex|fred|ralph|guy|male/i.test(v.name) ? 3 : 0) + (/en-(us|gb)/i.test(v.lang) ? 1 : 0) + (v.localService ? 0.5 : 0);
  voicePick = all.sort((a, b) => score(b) - score(a))[0];
  return voicePick;
}

let ctx: AudioContext | null = null;
/** Call from a click so the browser lets the little robot blip play later. */
export function primeAudio() {
  try { const A = window.AudioContext || (window as any).webkitAudioContext; if (!A) return; ctx = ctx ?? new A(); void ctx.resume(); } catch { /* audio unavailable */ }
}
function blip(f1: number, f2: number) {
  try {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(f1, t); o.frequency.setValueAtTime(f2, t + 0.07);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.17);
  } catch { /* ignore */ }
}

export function stopSpeaking() { try { if (voiceSupported()) window.speechSynthesis.cancel(); } catch { /* ignore */ } }

export function speak(text: string, on: { start?: () => void; end?: () => void }) {
  if (!voiceSupported()) return;
  const parts = chunks(speakable(text));
  if (!parts.length) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  blip(520, 780);
  const v = pickVoice();
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    u.pitch = 0.45; u.rate = 0.92; u.volume = 1;
    if (i === 0) u.onstart = () => on.start?.();
    if (i === parts.length - 1) { u.onend = () => { blip(780, 520); on.end?.(); }; u.onerror = () => on.end?.(); }
    synth.speak(u);
  });
}
