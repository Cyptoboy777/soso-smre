/**
 * Deterministic rule-based thesis engine (fallback when GEMINI_API_KEY is absent).
 * Pure functions — unit-tested.
 */
import type {
  EtfPanel,
  MarketPanel,
  NewsPanel,
  SsiPanel,
  Thesis,
  ThesisDrivers,
  ThesisSide,
} from '@/types/flow';
import { pickPrice } from '@/lib/sodex';
import crypto from 'crypto';

export interface SignalInputs {
  etfBtc: EtfPanel;
  etfEth: EtfPanel;
  news: NewsPanel;
  ssi: SsiPanel;
  market: MarketPanel;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function buildDrivers(input: SignalInputs): ThesisDrivers {
  return {
    etfBtcNetInflow: input.etfBtc.latest?.totalNetInflow ?? null,
    etfEthNetInflow: input.etfEth.latest?.totalNetInflow ?? null,
    ssiChangePct: input.ssi.changePct24h,
    newsShock: input.news.shockActive,
    topHeadlines: input.news.items.slice(0, 3).map((n) => n.title),
  };
}

/**
 * Score from -100 (strong short) to +100 (strong long).
 */
export function scoreFlows(drivers: ThesisDrivers): number {
  let score = 0;
  const btc = drivers.etfBtcNetInflow;
  const eth = drivers.etfEthNetInflow;
  if (btc != null) {
    // ±$200M ≈ ±40 points
    score += clamp(btc / 5_000_000, -40, 40);
  }
  if (eth != null) {
    score += clamp(eth / 3_000_000, -25, 25);
  }
  if (drivers.ssiChangePct != null) {
    // change_pct_24h is a decimal fraction from SoSoValue
    score += clamp(drivers.ssiChangePct * 1000, -20, 20);
  }
  if (drivers.newsShock) score *= 0.35;
  return clamp(score, -100, 100);
}

export function sideFromScore(score: number): ThesisSide {
  if (score >= 18) return 'LONG';
  if (score <= -18) return 'SHORT';
  return 'FLAT';
}

export function confidenceFromScore(score: number): number {
  const mag = Math.abs(score);
  return Math.round(clamp(45 + mag * 0.45, 40, 92));
}

export function buildRuleThesis(input: SignalInputs): Thesis {
  const drivers = buildDrivers(input);
  const score = scoreFlows(drivers);
  const side = sideFromScore(score);
  const preferEth =
    Math.abs(drivers.etfEthNetInflow ?? 0) > Math.abs(drivers.etfBtcNetInflow ?? 0) * 0.6 &&
    Math.abs(drivers.etfEthNetInflow ?? 0) > 20_000_000;
  const symbol = preferEth ? 'vETH_vUSDC' : 'vBTC_vUSDC';
  const entry = pickPrice(input.market, symbol);
  const atrProxy = entry * 0.012; // ~1.2% proxy
  const stopLoss = side === 'LONG' ? entry - atrProxy * 1.5 : side === 'SHORT' ? entry + atrProxy * 1.5 : entry;
  const takeProfit = side === 'LONG' ? entry + atrProxy * 2.5 : side === 'SHORT' ? entry - atrProxy * 2.5 : entry;
  const confidence = side === 'FLAT' ? Math.min(confidenceFromScore(score), 58) : confidenceFromScore(score);

  const btcFlow = drivers.etfBtcNetInflow;
  const ethFlow = drivers.etfEthNetInflow;
  const flowPhrase = (n: number | null, label: string) =>
    n == null ? `${label} flow unavailable` : `${label} US ETF net ${n >= 0 ? 'inflow' : 'outflow'} of $${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const ssiPct =
    drivers.ssiChangePct == null ? 'SSI flat/unavailable' : `ssiMAG7 ${drivers.ssiChangePct >= 0 ? '+' : ''}${(drivers.ssiChangePct * 100).toFixed(2)}% 24h`;

  let plain: string;
  if (side === 'FLAT') {
    plain = `No trade today. ${flowPhrase(btcFlow, 'BTC')} and ${flowPhrase(ethFlow, 'ETH')}; ${ssiPct}. Flows and index do not clear the conviction threshold${drivers.newsShock ? '; news-shock filter is active' : ''}.`;
  } else if (side === 'LONG') {
    plain = `Lean long ${symbol.replace(/v/g, '').replace('_', '/')}. ${flowPhrase(btcFlow, 'BTC')}; ${flowPhrase(ethFlow, 'ETH')}; ${ssiPct}. Plan: buy near $${entry.toLocaleString()}, stop $${stopLoss.toLocaleString()}, target $${takeProfit.toLocaleString()}.`;
  } else {
    plain = `Lean short ${symbol.replace(/v/g, '').replace('_', '/')}. ${flowPhrase(btcFlow, 'BTC')}; ${flowPhrase(ethFlow, 'ETH')}; ${ssiPct}. Plan: sell near $${entry.toLocaleString()}, stop $${stopLoss.toLocaleString()}, target $${takeProfit.toLocaleString()}.`;
  }

  return {
    id: `th_${crypto.randomBytes(5).toString('hex')}`,
    createdAt: new Date().toISOString(),
    side,
    symbol,
    plainEnglish: plain,
    confidence,
    entry: Number(entry.toPrecision(7)),
    stopLoss: Number(stopLoss.toPrecision(7)),
    takeProfit: Number(takeProfit.toPrecision(7)),
    drivers,
    engine: 'rules',
    horizonHours: 24,
  };
}
