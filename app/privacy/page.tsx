import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy · FlowSentinel',
  description: 'Privacy notes for FlowSentinel: minimal server logs, no custody of keys.',
};

export default function PrivacyPage() {
  return (
    <article className="panel" style={{ padding: 28, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Privacy</h1>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
        FlowSentinel does not custody private keys. Wallet signing, when you use it, stays in your wallet
        extension. Theme preference is stored locally in your browser (`fs-theme`).
      </p>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Desk questions sent to /api/chat include the text you typed and a snapshot of public desk data so
        answers stay grounded. We do not sell personal data. Server logs may retain request metadata for
        abuse prevention and rate limiting.
      </p>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Third-party APIs: SoSoValue (market data) and SoDEX (public tickers / optional signed practice
        orders). Review their policies as well.
      </p>
      <p>
        <Link href="/">Back to desk</Link>
      </p>
    </article>
  );
}
