/** Shared paper-trading portfolio shapes — single source of truth for the
 *  interfaces that used to be copy-pasted across the portfolio API route,
 *  the portfolio page, and the AI trade agent page. */

export interface Holding {
  symbol: string;
  amount: number;
  avgBuyPrice: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  total: number;
  timestamp: number;
}

export interface Portfolio {
  usdc: number;
  holdings: Record<string, Holding>;
  trades: Trade[];
  initialBalance: number;
  soPoints: number;
}
