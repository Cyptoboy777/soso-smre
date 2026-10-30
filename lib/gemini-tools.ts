/**
 * Server-only Jarvis tools for Gemini function calling.
 * buildOrderTicket never places — ticket draft only.
 */
import { fetchEtfFlows, fetchHotNews, fetchSsiSnapshot } from '@/lib/sosovalue';
import { fetchOrderBook, fetchTicker } from '@/lib/sodex-market';
import { evaluateRisk } from '@/lib/risk-engine';
import type { Thesis, ThesisSide } from '@/types/flow';

export const JARVIS_TOOL_DECLS = [
  {
    name: 'getETFFlows',
    description: 'Fetch latest US BTC or ETH ETF net inflow history from SoSoValue.',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', enum: ['BTC', 'ETH'], description: 'ETF asset' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'getNews',
    description: 'Fetch SoSoValue hot news with ids for citation.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
  {
    name: 'getSSI',
    description: 'Fetch ssiMAG7 market snapshot from SoSoValue.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getSoDEXOrderbook',
    description: 'Fetch public SoDEX spot orderbook for a symbol (no keys).',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'e.g. vBTC_vUSDC' },
        limit: { type: 'number' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'buildOrderTicket',
    description:
      'Build a proposed SoDEX testnet order ticket from side/symbol/levels. Never places an order.',
    parameters: {
      type: 'object',
      properties: {
        side: { type: 'string', enum: ['LONG', 'SHORT', 'FLAT'] },
        symbol: { type: 'string' },
        entry: { type: 'number' },
        stopLoss: { type: 'number' },
        takeProfit: { type: 'number' },
        confidence: { type: 'number' },
        plainEnglish: { type: 'string' },
      },
      required: ['side', 'symbol', 'entry', 'stopLoss', 'takeProfit', 'confidence', 'plainEnglish'],
    },
  },
] as const;

export async function runJarvisTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'getETFFlows': {
      const symbol = args.symbol === 'ETH' ? 'ETH' : 'BTC';
      const panel = await fetchEtfFlows(symbol);
      return {
        symbol,
        source: panel.meta.source,
        endpoint: panel.meta.endpoint,
        latest: panel.latest,
        historyDates: panel.history.slice(0, 5).map((d) => ({ date: d.date, net: d.totalNetInflow })),
      };
    }
    case 'getNews': {
      const news = await fetchHotNews();
      const limit = Math.min(12, Number(args.limit ?? 8) || 8);
      return {
        source: news.meta.source,
        shockActive: news.shockActive,
        items: news.items.slice(0, limit).map((n) => ({
          id: n.id,
          title: n.title,
          summary: n.summary.slice(0, 180),
          url: n.url,
          isShock: n.isShock,
        })),
      };
    }
    case 'getSSI': {
      const ssi = await fetchSsiSnapshot('ssimag7');
      return {
        ticker: ssi.ticker,
        price: ssi.price,
        changePct24h: ssi.changePct24h,
        roi7d: ssi.roi7d,
        source: ssi.meta.source,
        endpoint: ssi.meta.endpoint,
      };
    }
    case 'getSoDEXOrderbook': {
      const symbol = String(args.symbol || 'vBTC_vUSDC');
      const [book, tick] = await Promise.all([
        fetchOrderBook(symbol, Math.min(30, Number(args.limit ?? 16) || 16)),
        fetchTicker(symbol),
      ]);
      return {
        symbol,
        ticker: tick.ticker,
        gateway: book?.gateway ?? tick.gateway,
        topBids: book?.bids.slice(0, 8) ?? [],
        topAsks: book?.asks.slice(0, 8) ?? [],
      };
    }
    case 'buildOrderTicket': {
      const side = (args.side as ThesisSide) || 'FLAT';
      const thesis: Thesis = {
        id: `ticket_${Date.now()}`,
        createdAt: new Date().toISOString(),
        side,
        symbol: String(args.symbol || 'vBTC_vUSDC'),
        plainEnglish: String(args.plainEnglish || ''),
        confidence: Number(args.confidence) || 0,
        entry: Number(args.entry) || 0,
        stopLoss: Number(args.stopLoss) || 0,
        takeProfit: Number(args.takeProfit) || 0,
        drivers: {
          etfBtcNetInflow: null,
          etfEthNetInflow: null,
          ssiChangePct: null,
          newsShock: false,
          topHeadlines: [],
        },
        engine: 'gemini',
        horizonHours: 24,
      };
      const news = await fetchHotNews();
      const risk = evaluateRisk(thesis, news);
      return {
        ticketOnly: true,
        neverPlaces: true,
        modeLabel: 'TESTNET_TICKET_DRAFT',
        thesis,
        risk,
        narration: [
          `Ticket ${thesis.side} ${thesis.symbol}.`,
          `Entry ${thesis.entry}, stop ${thesis.stopLoss}, target ${thesis.takeProfit}.`,
          `Confidence ${thesis.confidence}.`,
          risk.approved
            ? `Risk gate passed. Size ${risk.positionSize} (~$${risk.notionalUsd.toFixed(0)}).`
            : `Risk gate blocked: ${risk.checks.filter((c) => !c.passed).map((c) => c.label).join(', ') || 'see checks'}.`,
          'Voice never places orders. Confirm on the desk for SoDEX testnet only.',
        ].join(' '),
      };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}
