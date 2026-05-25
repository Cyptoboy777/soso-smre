import type { WsTickerData, Ticker, L2BookData, OrderBook, Network } from '@/types/sodex'

// ── Endpoints ─────────────────────────────────────────────────────────────────
export const ENDPOINTS = {
  mainnet: {
    ws:   'wss://mainnet-gw.sodex.dev/ws/spot',
    rest: 'https://mainnet-gw.sodex.dev/api/v1/spot',
  },
  testnet: {
    ws:   'wss://testnet-gw.sodex.dev/ws/spot',
    rest: 'https://testnet-gw.sodex.dev/api/v1/spot',
  },
} satisfies Record<Network, { ws: string; rest: string }>

// ── Normalisers ───────────────────────────────────────────────────────────────
export function normaliseTicker(raw: WsTickerData): Ticker {
  // SoDEX format: "vBTC_vUSDC" or "WSOSO_vUSDC" (underscore separator, v prefix)
  const parts = raw.s.split('_')
  const rawBase  = parts[0] ?? ''
  const rawQuote = parts[1] ?? ''
  // Strip leading 'v' prefix (vBTC → BTC, vUSDC → USDC, WSOSO → WSOSO)
  const base  = rawBase.startsWith('v')  ? rawBase.slice(1)  : rawBase
  const quote = rawQuote.startsWith('v') ? rawQuote.slice(1) : rawQuote
  const bid = parseFloat(raw.b) || 0
  const ask = parseFloat(raw.a) || 0
  return {
    symbol:        raw.s,
    base,
    quote,
    lastPrice:     parseFloat(raw.c) || 0,
    priceChange:   parseFloat(raw.p) || 0,
    priceChangePct: raw.P ?? 0,
    high:          parseFloat(raw.h) || 0,
    low:           parseFloat(raw.l) || 0,
    open:          parseFloat(raw.o) || 0,
    baseVolume:    parseFloat(raw.v) || 0,
    quoteVolume:   parseFloat(raw.q) || 0,
    bestBid:       bid,
    bestAsk:       ask,
    spread:        ask > 0 && bid > 0 ? ask - bid : 0,
    updatedAt:     raw.E ?? Date.now(),
  }
}

export function normaliseL2Book(raw: L2BookData): OrderBook {
  let bidTotal = 0
  let askTotal = 0

  const bids = raw.b.map(([p, q]) => {
    const price = parseFloat(p)
    const qty   = parseFloat(q)
    bidTotal += qty
    return { price, qty, total: bidTotal }
  })

  const asks = raw.a.map(([p, q]) => {
    const price = parseFloat(p)
    const qty   = parseFloat(q)
    askTotal += qty
    return { price, qty, total: askTotal }
  })

  const bestBid = bids[0]?.price ?? 0
  const bestAsk = asks[0]?.price ?? 0
  const spread  = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0
  const spreadPct = bestAsk > 0 ? (spread / bestAsk) * 100 : 0

  return {
    symbol:    raw.s,
    bids,
    asks,
    spread,
    spreadPct,
    updatedAt: raw.E ?? Date.now(),
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────
export function fmtPrice(n: number, decimals?: number): string {
  if (!n || isNaN(n)) return '—'
  const d = decimals ?? (n >= 1000 ? 2 : n >= 1 ? 4 : 6)
  return n.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

export function fmtVol(n: number): string {
  if (!n || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K'
  return n.toFixed(2)
}

export function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}
