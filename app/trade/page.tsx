import type { Metadata } from 'next';
import { ExecutionTicket } from '@/components/ExecutionTicket';
import type { Thesis } from '@/types/flow';

export const metadata: Metadata = {
  title: 'Trade',
  description: 'Prepare a SoDEX spot order, review cost and evidence, then sign it yourself.',
};

const TICKET: Thesis = {
  id: 'trade-ticket',
  createdAt: '1970-01-01T00:00:00.000Z',
  side: 'LONG',
  symbol: 'vBTC_vUSDC',
  plainEnglish: 'Spot ticket. You choose the price and size, then sign.',
  confidence: 0,
  entry: 0,
  stopLoss: 0,
  takeProfit: 0,
  drivers: {
    etfBtcNetInflow: null,
    etfEthNetInflow: null,
    ssiChangePct: null,
    newsShock: false,
    topHeadlines: [],
  },
  engine: 'rules',
  horizonHours: 24,
};

export default function TradePage() {
  return (
    <div className="trade-page">
      <header className="trade-intro">
        <h1>Trade</h1>
        <p>Review one mainnet order. Submission stays off until release.</p>
      </header>
      <ExecutionTicket thesis={TICKET} quantity={0} />
    </div>
  );
}
