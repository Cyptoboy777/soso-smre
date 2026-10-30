import { DeskClient } from '@/components/DeskClient';

export default function HomePage() {
  return (
    <div>
      <p
        style={{
          margin: '0 0 20px',
          color: 'var(--text-muted)',
          fontSize: 15,
          maxWidth: 640,
          textWrap: 'pretty',
        }}
      >
        One-person fund desk for the SoSoValue buildathon. Reads live ETF flows and hot news,
        writes a plain-English thesis, runs a risk gate, then places a confirmed SoDEX testnet
        limit order. Every idea is logged on the public track record.
      </p>
      <DeskClient />
    </div>
  );
}
