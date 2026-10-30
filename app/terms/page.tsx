import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms · FlowSentinel',
  description: 'Terms of use for FlowSentinel — testnet demo, not financial advice.',
};

export default function TermsPage() {
  return (
    <article className="panel" style={{ padding: 28, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Terms of use</h1>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
        FlowSentinel is a Wave 3 buildathon demo. It is provided as-is for education and judging. It is
        not financial, investment, legal, or tax advice. Nothing on this site is an offer to buy or sell
        any asset.
      </p>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Orders, when enabled, target SoDEX testnet only. There is no mainnet trading path in this app.
        Voice mode never places orders. You are responsible for any keys you load on your own device.
      </p>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Data from SoSoValue and SoDEX may be delayed, incomplete, or labelled Fallback when live keys or
        network access are unavailable. Public track-record outcomes are illustrative and may use mark
        prices.
      </p>
      <p>
        <Link href="/">Back to desk</Link>
      </p>
    </article>
  );
}
