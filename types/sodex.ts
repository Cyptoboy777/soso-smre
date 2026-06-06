/** WsTickerData — exact field names from docs snapshot example */
export interface WsTickerData {
  E: number    // Event time ms
  s: string    // Symbol e.g. "BTC-USD"
  c: string    // Last price
  Q: string    // Last qty
  w: string    // Weighted avg price
  a: string    // Best ask price
  A: string    // Best ask qty
  b: string    // Best bid price
  B: string    // Best bid qty
  p: string    // Price change (absolute)
  P: number    // Price change percent
  o: string    // Open price
  h: string    // High price
  l: string    // Low price
  v: string    // Base volume
  q: string    // Quote volume
  O: number    // Open time ms
  C: number    // Close time ms
}

/** Normalised ticker used by UI */
export interface Ticker {
  symbol: string
  base: string        // e.g. "BTC" from "BTC-USD"
  quote: string       // e.g. "USD"
  lastPrice: number
  priceChange: number
  priceChangePct: number
  high: number
  low: number
  open: number
  baseVolume: number
  quoteVolume: number
  bestBid: number
  bestAsk: number
  spread: number
  updatedAt: number
}

/** L2 Order Book from WS */
export interface L2BookData {
  s: string             // Symbol
  u: number             // Update ID
  E: number             // Event time
  b: [string, string][] // [price, qty] bids best → worst
  a: [string, string][] // [price, qty] asks best → worst
}

export interface OrderBook {
  symbol: string
  bids: { price: number; qty: number; total: number }[]
  asks: { price: number; qty: number; total: number }[]
  spread: number
  spreadPct: number
  updatedAt: number
}

export type Network = 'mainnet' | 'testnet';

export interface TradeSetup {
  side: 'BUY' | 'SELL';
  entry: number;
  sl: number;
  tp: number[]; // Can be multiple TPs (TP1, TP2, TP3)
  trailingStop: boolean;
  breakevenMove: boolean;
}

export interface RiskSettings {
  maxRiskPerTradePct: number; // e.g. 1%
  maxDailyRiskPct: number;    // e.g. 3%
  minRR: number;              // e.g. 2.0 (1:2)
}

export interface ExecutedOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  timestamp: number;
  mode: 'paper' | 'real';
}

export interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  entryPrice: number;
  unrealizedPnL: number;
  mode: 'paper' | 'real';
}
