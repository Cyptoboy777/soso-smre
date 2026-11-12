import { ExecutionTicket } from '@/components/ExecutionTicket';
import { MarketContext } from '@/components/MarketContext';
import type { Thesis } from '@/types/flow';

const TICKET: Thesis = {
  id: 'swap-ticket',
  createdAt: '1970-01-01T00:00:00.000Z',
  side: 'LONG',
  symbol: 'vBTC_vUSDC',
  plainEnglish: 'Spot swap. You choose the price and size, then sign.',
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

const STEPS = ['Connect wallet', 'Read the live book', 'Check context', 'See cost before signing', 'Sign in your wallet', 'Get a receipt'];

/** Primary product surface: a wallet-signed SoDEX mainnet spot swap. */
export function SwapScreen() {
  return (
    <div className="trade-page swap-page">
      <header className="swap-intro">
        <h1>Swap on SoDEX, signed by you</h1>
        <p>
          Live mainnet order book, SoSoValue context and a depth-based cost estimate before your wallet signs. Every
          order needs your own signature. Nothing trades while you are away.
        </p>
        <ol className="swap-steps" aria-label="How a swap works here">
          {STEPS.map((step, i) => (
            <li key={step}>
              <span className="swap-step-n tabular" aria-hidden>
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </header>
      <MarketContext />
      <ExecutionTicket thesis={TICKET} quantity={0} />
    </div>
  );
}
