/**
 * JARVIS-style briefing: ranked actionable ideas from SoSoValue + SoDEX.
 * Gemini when GEMINI_API_KEY exists; else deterministic news/flow rules.
 */
import type {
  DeskSnapshot,
  JarvisBriefing,
  JarvisCitation,
  JarvisIdea,
  ThesisSide,
} from '@/types/flow';
import { pickPrice } from '@/lib/sodex';
import {
  extractJsonArray,
  geminiGenerate,
  geminiGroundedBrief,
  geminiWithTools,
  GeminiRateLimitError,
  hasGeminiKey,
} from '@/lib/gemini';

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function hourGreeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}


function levels(entry: number, side: ThesisSide): { stopLoss: number; takeProfit: number } {
  if (side === 'FLAT' || entry <= 0) return { stopLoss: entry, takeProfit: entry };
  if (side === 'LONG') return { stopLoss: entry * 0.985, takeProfit: entry * 1.025 };
  return { stopLoss: entry * 1.015, takeProfit: entry * 0.975 };
}

function ruleIdeas(desk: DeskSnapshot): JarvisIdea[] {
  const { etfBtc, etfEth, news, ssi, market, thesis } = desk;
  const btc = etfBtc.latest?.totalNetInflow ?? 0;
  const eth = etfEth.latest?.totalNetInflow ?? 0;
  const ssiCh = ssi.changePct24h ?? 0;
  const shock = news.shockActive;
  const topNews = news.items.slice(0, 4);

  const citeNews = (i: number): JarvisCitation[] => {
    const n = topNews[i];
    if (!n) return [];
    return [{ kind: 'news', label: n.title.slice(0, 72), detail: n.summary.slice(0, 140), url: n.url }];
  };

  const ideas: JarvisIdea[] = [];

  // Idea 1 - primary desk thesis, priced off SoDEX
  {
    const symbol = thesis.symbol || 'vBTC_vUSDC';
    const entry = pickPrice(market, symbol) || thesis.entry;
    const side = shock ? 'FLAT' : thesis.side;
    const lv = levels(entry, side);
    ideas.push({
      rank: 1,
      side,
      symbol,
      title: side === 'FLAT' ? 'Stand aside: conviction gate closed' : `${side} ${symbol.replace('v', '').replace('_', '/')}`,
      reasoning: thesis.plainEnglish,
      citations: [
        { kind: 'etf', label: 'BTC US ETF net', detail: money(btc) },
        { kind: 'etf', label: 'ETH US ETF net', detail: money(eth) },
        { kind: 'ssi', label: 'ssiMAG7 24h', detail: `${ssiCh >= 0 ? '+' : ''}${((ssiCh || 0) * 100).toFixed(2)}%` },
        ...citeNews(0),
      ],
      confidence: shock ? Math.min(thesis.confidence, 45) : thesis.confidence,
      riskNote: shock
        ? 'News-shock filter is active. Size is zero until headlines cool.'
        : 'Risk engine caps notional; confirm ticket before any SoDEX testnet order.',
      invalidation:
        side === 'LONG'
          ? `Break below ${lv.stopLoss.toFixed(0)} on SoDEX last, or ETF flip to net outflow.`
          : side === 'SHORT'
            ? `Reclaim above ${lv.stopLoss.toFixed(0)}, or ETF inflows accelerate.`
            : 'Re-open only if ETF + SSI align and shock headlines clear.',
      entry,
      stopLoss: lv.stopLoss,
      takeProfit: lv.takeProfit,
      horizonHours: thesis.horizonHours || 24,
    });
  }

  // Idea 2 - ETH vs BTC flow divergence watch
  {
    const ethStronger = Math.abs(eth) > Math.abs(btc) * 0.55 && eth > 0;
    const ethWeaker = eth < 0 && btc > 0;
    const side: ThesisSide = shock ? 'FLAT' : ethStronger ? 'LONG' : ethWeaker ? 'SHORT' : 'FLAT';
    const symbol = 'vETH_vUSDC';
    const entry = pickPrice(market, symbol);
    const lv = levels(entry, side);
    ideas.push({
      rank: 2,
      side,
      symbol,
      title: ethStronger
        ? 'ETH relative strength vs BTC flows'
        : ethWeaker
          ? 'Fade ETH while BTC books still print'
          : 'Watch ETH/BTC flow spread',
      reasoning: ethStronger
        ? `ETH ETF net ${money(eth)} outpaces BTC ${money(btc)}; prefer ETH beta if SSI holds.`
        : ethWeaker
          ? `ETH ETF net ${money(eth)} while BTC still ${money(btc)}. ETH lag risk.`
          : `Flow spread is muted (BTC ${money(btc)}, ETH ${money(eth)}). Keep as a watch, not a force.`,
      citations: [
        { kind: 'etf', label: 'BTC US ETF', detail: money(btc) },
        { kind: 'etf', label: 'ETH US ETF', detail: money(eth) },
        ...citeNews(1),
      ],
      confidence: shock ? 35 : ethStronger || ethWeaker ? 62 : 48,
      riskNote: 'ETH beta can gap on L2 / staking headlines. Keep stops tight.',
      invalidation: `ETH ETF flips sign vs today (${money(eth)}) or ssiMAG7 drops >2% session.`,
      entry,
      stopLoss: lv.stopLoss,
      takeProfit: lv.takeProfit,
      horizonHours: 36,
    });
  }

  // Idea 3 - news / SSI event watch
  {
    const headline = topNews[0];
    const bullishNews = headline ? /\b(etf|inflow|approval|record|surge|all-?time high)\b/i.test(headline.title) : false;
    const bearishNews = headline ? /\b(outflow|hack|sec|lawsuit|ban|probe)\b/i.test(headline.title) : false;
    const side: ThesisSide = shock || bearishNews ? 'FLAT' : bullishNews && ssiCh >= 0 ? 'LONG' : 'FLAT';
    const symbol = 'vBTC_vUSDC';
    const entry = pickPrice(market, symbol);
    const lv = levels(entry, side);
    ideas.push({
      rank: 3,
      side,
      symbol,
      title: side === 'LONG' ? 'News + SSI alignment scalp' : 'Event desk: do not chase',
      reasoning: headline
        ? `Headline: “${headline.title}”. SSI 24h ${((ssiCh || 0) * 100).toFixed(2)}%. ${
            side === 'LONG' ? 'Only a small long if risk gate passes.' : 'No force. Wait for confirmation prints.'
          }`
        : 'No fresh headline leadership. Keep powder dry.',
      citations: [...citeNews(0), ...citeNews(2), { kind: 'ssi', label: 'ssiMAG7', detail: String(ssi.price ?? 'n/a') }],
      confidence: side === 'LONG' ? 55 : 40,
      riskNote: 'News fades fast; invalidation is time-based as much as price-based.',
      invalidation: 'If the cited headline is walked back, or price fails to hold entry ±0.8% in 4h.',
      entry,
      stopLoss: lv.stopLoss,
      takeProfit: lv.takeProfit,
      horizonHours: 12,
    });
  }

  return ideas;
}

async function geminiIdeas(desk: DeskSnapshot, fallback: JarvisIdea[]): Promise<JarvisIdea[]> {
  const newsCatalog = desk.news.items.slice(0, 8).map((n) => ({
    id: n.id,
    title: n.title,
    summary: n.summary.slice(0, 160),
  }));
  const cacheKey = [
    'jarvis',
    desk.etfBtc.latest?.totalNetInflow ?? 'x',
    desk.etfEth.latest?.totalNetInflow ?? 'x',
    desk.ssi.changePct24h ?? 'x',
    desk.news.shockActive ? '1' : '0',
    newsCatalog[0]?.id ?? 'n',
    desk.market.tickers[0]?.lastPrice ?? 'p',
  ].join('|');

  try {
    const prompt = `You are JARVIS for FlowSentinel, a calm, precise crypto fund copilot.
Return ONLY a JSON array of exactly 3 trade/watch ideas.

DATA:
BTC ETF net: ${desk.etfBtc.latest?.totalNetInflow} (${desk.etfBtc.meta.source})
ETH ETF net: ${desk.etfEth.latest?.totalNetInflow} (${desk.etfEth.meta.source})
ssiMAG7: price=${desk.ssi.price} ch24=${desk.ssi.changePct24h} (${desk.ssi.meta.source})
News shock: ${desk.news.shockActive}
News catalog (cite by id): ${JSON.stringify(newsCatalog)}
SoDEX: ${desk.market.tickers.map((t) => `${t.symbol}=${t.lastPrice}`).join(', ')}

Each idea object MUST include citedNewsIds (array of news catalog ids you used):
{"rank":1,"side":"LONG"|"SHORT"|"FLAT","symbol":"vBTC_vUSDC"|"vETH_vUSDC","title":"...","reasoning":"2-3 sentences; mention [news:ID]","citedNewsIds":["id1"],"citations":[{"kind":"news|etf|ssi|market","label":"...","detail":"..."}],"confidence":0-100,"riskNote":"...","invalidation":"...","entry":number,"stopLoss":number,"takeProfit":number,"horizonHours":number}

Prefer FLAT when shock or weak conviction. Use SoDEX last prices for entry/stop/target.`;

    const text = await geminiGenerate({
      prompt,
      cacheKey,
      system: 'Return only a JSON array. No markdown fences.',
    });
    // Prefer array; also accept {ideas:[...]}
    let arr = extractJsonArray(text);
    if (!arr) {
      const obj = text.match(/\{[\s\S]*\}/);
      if (obj) {
        try {
          const parsed = JSON.parse(obj[0]) as { ideas?: unknown[] };
          if (Array.isArray(parsed.ideas)) arr = parsed.ideas;
        } catch { /* */ }
      }
    }
    if (!arr || arr.length < 1) return fallback;
    return arr.slice(0, 3).map((raw, i) => {
      const r = raw as Record<string, unknown>;
      const fb = fallback[i] ?? fallback[0]!;
      const side = r.side === 'LONG' || r.side === 'SHORT' || r.side === 'FLAT' ? r.side : fb.side;
      const symbol = r.symbol === 'vETH_vUSDC' ? 'vETH_vUSDC' : 'vBTC_vUSDC';
      const citedIds = Array.isArray(r.citedNewsIds) ? (r.citedNewsIds as unknown[]).map(String) : [];
      const newsCites: JarvisCitation[] = citedIds
        .map((id) => desk.news.items.find((n) => n.id === id))
        .filter(Boolean)
        .map((n) => ({
          kind: 'news' as const,
          label: n!.title.slice(0, 72),
          detail: n!.summary.slice(0, 140),
          url: n!.url,
        }));
      const citations = [
        ...newsCites,
        ...(Array.isArray(r.citations) ? (r.citations as JarvisCitation[]) : []),
      ].slice(0, 6);
      return {
        rank: i + 1,
        side,
        symbol,
        title: String(r.title ?? fb.title),
        reasoning: String(r.reasoning ?? fb.reasoning),
        citations: citations.length ? citations : fb.citations,
        confidence: Math.round(Math.max(0, Math.min(100, Number(r.confidence ?? fb.confidence)))),
        riskNote: String(r.riskNote ?? fb.riskNote),
        invalidation: String(r.invalidation ?? fb.invalidation),
        entry: Number(r.entry ?? fb.entry) || fb.entry,
        stopLoss: Number(r.stopLoss ?? fb.stopLoss) || fb.stopLoss,
        takeProfit: Number(r.takeProfit ?? fb.takeProfit) || fb.takeProfit,
        horizonHours: Number(r.horizonHours ?? fb.horizonHours) || fb.horizonHours,
      } satisfies JarvisIdea;
    });
  } catch (e) {
    if (e instanceof GeminiRateLimitError) console.warn('[jarvis] Gemini rate-limited - rules');
    else console.warn('[jarvis] Gemini unavailable - rules');
    return fallback;
  }
}

export async function buildJarvisBriefing(desk: DeskSnapshot): Promise<JarvisBriefing> {
  const rules = ruleIdeas(desk);
  let ideas = rules;
  let engine: 'gemini' | 'rules' = 'rules';
  let groundedSources: { title: string; uri: string }[] = [];

  if (hasGeminiKey()) {
    try {
      // Tool-assisted pass enriches context; still parse structured ideas from geminiIdeas
      await geminiWithTools({
        prompt: `Prepare a FlowSentinel briefing. Call getETFFlows for BTC and ETH, getNews, getSSI, and getSoDEXOrderbook for ${desk.thesis.symbol}. Then summarize in one short paragraph. Do not place orders.`,
        cacheKey: `jarvis-tools|${desk.news.items[0]?.id ?? 'n'}|${desk.etfBtc.latest?.totalNetInflow ?? 'x'}`,
        maxRounds: 3,
      });
      ideas = await geminiIdeas(desk, rules);
      engine = 'gemini';
      try {
        const g = await geminiGroundedBrief({
          prompt: `Cross-check these SoSoValue headlines for today (do not invent fills): ${desk.news.items
            .slice(0, 4)
            .map((n) => n.title)
            .join(' | ')}. Return a 2-sentence market context.`,
          cacheKey: `jarvis-ground|${desk.news.items[0]?.id ?? 'n'}`,
        });
        groundedSources = g.sources;
        if (g.text && ideas[0]) {
          ideas[0] = {
            ...ideas[0],
            reasoning: `${ideas[0].reasoning} Context: ${g.text.slice(0, 280)}`,
            citations: [
              ...ideas[0].citations,
              ...groundedSources.slice(0, 3).map((s) => ({
                kind: 'news' as const,
                label: s.title.slice(0, 72),
                detail: 'Google Search grounding',
                url: s.uri,
              })),
            ].slice(0, 8),
          };
        }
      } catch {
        /* grounding optional on free tier */
      }
    } catch {
      ideas = rules;
      engine = 'rules';
    }
  }

  const top = ideas[0];
  const greeting = hourGreeting();
  const spokenSummary = `${greeting}. Here's what moved. ${
    top
      ? `Top idea: ${top.title}. ${top.side} on ${top.symbol.replace(/v/g, '').replace('_', ' ')} with confidence ${top.confidence}. ${top.reasoning} Ticket would be entry ${top.entry}, stop ${top.stopLoss}, target ${top.takeProfit}.`
      : 'No high-conviction setup. Standing aside.'
  } Voice never places orders.`;

  return {
    greeting,
    spokenSummary,
    asOf: new Date().toISOString(),
    ideas,
    engine,
    newsShock: desk.news.shockActive,
  };
}
