export type DataSource = 'live' | 'fallback' | 'unavailable';

export interface SourceMeta {
  source: DataSource;
  endpoint?: string;
  fetchedAt: string;
  note?: string;
}

export interface EtfFlowDay {
  date: string;
  totalNetInflow: number;
  totalValueTraded: number;
  totalNetAssets: number;
  cumNetInflow: number;
}

export interface EtfPanel {
  symbol: 'BTC' | 'ETH';
  country: 'US';
  latest: EtfFlowDay | null;
  history: EtfFlowDay[];
  meta: SourceMeta;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  isShock: boolean;
}

export interface NewsPanel {
  items: NewsItem[];
  meta: SourceMeta;
  shockActive: boolean;
}

export interface SsiPanel {
  ticker: string;
  price: number | null;
  changePct24h: number | null;
  roi7d: number | null;
  meta: SourceMeta;
}

export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  changePct24h: number;
  high: number;
  low: number;
  volume: number;
}

export interface MarketPanel {
  tickers: MarketTicker[];
  meta: SourceMeta;
}

export type ThesisSide = 'LONG' | 'SHORT' | 'FLAT';

export interface ThesisDrivers {
  etfBtcNetInflow: number | null;
  etfEthNetInflow: number | null;
  ssiChangePct: number | null;
  newsShock: boolean;
  topHeadlines: string[];
}

export interface Thesis {
  id: string;
  createdAt: string;
  side: ThesisSide;
  symbol: string; // SoDEX spot e.g. vBTC_vUSDC
  plainEnglish: string;
  confidence: number; // 0-100
  entry: number;
  stopLoss: number;
  takeProfit: number;
  drivers: ThesisDrivers;
  engine: 'gemini' | 'rules';
  horizonHours: number;
}

export interface RiskCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface RiskDecision {
  approved: boolean;
  checks: RiskCheck[];
  positionSize: number; // base asset qty
  notionalUsd: number;
  riskUsd: number;
  riskPct: number;
  equityUsd: number;
}

export interface OrderRequest {
  thesisId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  confirmed: boolean;
}

export interface OrderResult {
  mode: 'live' | 'dry-run';
  orderId: string;
  status: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  submittedAt: string;
  note: string;
}

export type OutcomeStatus = 'open' | 'hit_tp' | 'hit_sl' | 'expired' | 'cancelled';

export interface TrackRecordEntry {
  id: string;
  thesisId: string;
  createdAt: string;
  side: ThesisSide;
  symbol: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  plainEnglish: string;
  orderMode: 'live' | 'dry-run' | 'idea-only';
  orderId?: string;
  horizonHours: number;
  resolveAfter: string;
  outcome: OutcomeStatus;
  exitPrice?: number;
  pnlPct?: number;
  resolvedAt?: string;
  drivers: ThesisDrivers;
}

export interface DeskSnapshot {
  etfBtc: EtfPanel;
  etfEth: EtfPanel;
  news: NewsPanel;
  ssi: SsiPanel;
  market: MarketPanel;
  thesis: Thesis;
  risk: RiskDecision;
  demoMode: boolean;
}
