'use client';

export interface DogEmotion {
  pitch: number;
  rate: number;
  barkType: 'happy' | 'alert' | 'sad';
}

export const EmotionMap: Record<string, DogEmotion> = {
  excited: { pitch: 1.5, rate: 1.1, barkType: 'happy' },
  happy: { pitch: 1.3, rate: 1.0, barkType: 'happy' },
  sad: { pitch: 0.7, rate: 0.8, barkType: 'sad' },
  alert: { pitch: 1.1, rate: 1.2, barkType: 'alert' },
  neutral: { pitch: 1.0, rate: 1.0, barkType: 'happy' },
};

export function speak(text: string, emotion: string = 'neutral', onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  
  const config = EmotionMap[emotion] || EmotionMap.neutral;
  
  // Scooby-ify the text
  let scoobyText = text.replace(/(Woof|Bark|Arf)/gi, 'Rrrr-woof-woof!');
  if (!scoobyText.startsWith('R')) scoobyText = 'Ruh-roh! ' + scoobyText;

  const utterance = new SpeechSynthesisUtterance(scoobyText.replace(/[*_#]/g, ''));
  
  const voices = window.speechSynthesis.getVoices();
  const dogVoice = voices.find(v => v.name.includes('Male') || v.name.includes('UK English')) || voices[0];
  
  if (dogVoice) utterance.voice = dogVoice;
  utterance.pitch = config.pitch;
  utterance.rate = config.rate;
  utterance.volume = 1;

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
}
