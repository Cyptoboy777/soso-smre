/**
 * components/SoEva/types.ts
 * Shared types for all SoEva sub-components
 */

export type Emotion = 'divine' | 'joy' | 'alert' | 'serious';

export interface EmotionConfig {
  label: string;
  color: string;
  glow: string;
  emoji: string;
  desc: string;
}

export const EMOTION_CFG: Record<Emotion, EmotionConfig> = {
  divine:  { label: 'DIVINE',  color: '#a78bfa', glow: 'rgba(167,139,250,0.5)', emoji: '✨', desc: 'Calm & Insightful' },
  joy:     { label: 'JOY',     color: '#fbbf24', glow: 'rgba(251,191,36,0.5)',  emoji: '🚀', desc: 'Bullish & Energetic' },
  alert:   { label: 'ALERT',   color: '#f43f5e', glow: 'rgba(244,63,94,0.5)',   emoji: '⚠️', desc: 'Bearish & Urgent' },
  serious: { label: 'SERIOUS', color: '#38bdf8', glow: 'rgba(56,189,248,0.5)',  emoji: '📊', desc: 'Analytical & Deep' },
};

export interface ScriptLine {
  host: 'eva' | 'echo';
  text: string;
}

export interface EvaState {
  playing: boolean;
  lineIndex: number;
  emotion: Emotion;
  muted: boolean;
  speakingHost: 'eva' | 'echo' | null;
  topic: string;
  script: ScriptLine[];
  isGenerating: boolean;
  error: string | null;
}
