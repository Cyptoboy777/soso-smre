import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy · FlowSentinel',
  description: 'Privacy notes for FlowSentinel: local voice models, minimal server logs.',
};

export default function PrivacyPage() {
  return (
    <article className="panel" style={{ padding: 28, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Privacy</h1>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Voice models (Kokoro, Piper, Whisper via transformers.js) download and run in your browser when
        you open voice mode. Microphone audio for recognition is processed locally when using Whisper, or
        by the browser Web Speech API when that fallback is used (which may involve the browser vendor).
      </p>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Desk questions sent to /api/voice include the text you typed or transcribed and a snapshot of
        public desk data so answers stay grounded. We do not sell personal data. Server logs may retain
        request metadata for abuse prevention and rate limiting.
      </p>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Third-party APIs: SoSoValue (market data) and SoDEX testnet (public tickers / optional signed
        testnet orders). Review their policies as well.
      </p>
      <p>
        <Link href="/">Back to desk</Link>
      </p>
    </article>
  );
}
