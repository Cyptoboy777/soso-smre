import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { GET as getPrices } from '../prices/route';

interface Body {
  token: string;
  riskProfile: string;
  timeframe?: string;
  buyZone?: string;
  sellZone?: string;
  chatId?: string;
}

interface AISignal {
  signal: 'BUY' | 'SELL' | 'HOLD';
  reasoning: string;
  confidence: number;
  stopLoss: string;
  target: string;
  timeframe: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

function buildPrompt(
  token: string, tf: string, risk: string,
  price: string, change: string,
  buyZone: string, sellZone: string,
  news: string,
  marketSnapshot: string,
  globalMcap: string
) {
  return `You are an elite institutional crypto trading research analyst for SoSo SMRE platform.

=== LIVE MARKET SNAPSHOT (SoDEX Real-Time Prices) ===
${marketSnapshot}
Global Market Cap: ${globalMcap}

=== TARGET ASSET ===
- Asset: ${token}/USDC (SoDEX)
- Timeframe: ${tf}
- Risk Tolerance: ${risk}
- Current Spot Price: $${price}
- 24h Change: ${change}%
- User Entry Zone: ${buyZone || 'Market Price'}
- User Target Zone: ${sellZone || 'Fibonacci Extension'}

=== LATEST MARKET INTELLIGENCE (SoSoValue News) ===
${news || 'No high-impact news detected.'}

=== TASK ===
Generate a high-conviction institutional analysis report for ${token}.
- Use RSI, MACD, order flow, and volume analysis based on price context.
- Reference the market snapshot to assess overall risk-on/risk-off environment.
- Incorporate the news context into reasoning.
- CRITICAL: Provide EXACT numerical price targets. No placeholders like "X%" or "resistance".
- Your stop loss and target MUST be real dollar amounts based on the spot price.
- Response must be a clean JSON object ONLY. No markdown, no extra text.

Output JSON:
{"signal":"BUY"|"SELL"|"HOLD","reasoning":"4-5 sentences of deep technical + fundamental synthesis. Mention price levels, market structure, and news impact.","confidence":60-98,"stopLoss":"$XX.XX","target":"$XX.XX","timeframe":"${tf}","riskLevel":"LOW"|"MEDIUM"|"HIGH"}`;
}


async function fetchLivePrice(token: string) {
  try {
    const res = await getPrices();
    const data = await res.json() as { prices?: Array<{ symbol: string; price: string; change: string }>, source?: string };
    
    // Check for SoDEX format (vBTC_vUSDC) or CoinGecko (BTCUSDT)
    const isSodex = data.source === 'sodex';
    const sym = isSodex ? `v${token.toUpperCase()}_vUSDC` : `${token.toUpperCase()}USDT`;
    
    const found = data.prices?.find(p => p.symbol === sym);
    if (found) {
      return { price: found.price, change: found.change };
    }
    
    // Fallback to Binance
    const bSym = token.toUpperCase() + 'USDT';
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${bSym}`);
    if (r.ok) {
      const d = await r.json() as { lastPrice: string; priceChangePercent: string };
      return { price: parseFloat(d.lastPrice).toFixed(4), change: parseFloat(d.priceChangePercent).toFixed(2) };
    }
    return { price: '1.00', change: '0' };
  } catch {
    return { price: '1.00', change: '0' };
  }
}

async function runGemini(prompt: string): Promise<AISignal> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const client = new GoogleGenAI({ apiKey: key });
  const res = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  const text = (res.text ?? '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(text) as AISignal;
}

async function runGroq(prompt: string): Promise<AISignal> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const groq = new Groq({ apiKey: key });
  const c = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are an elite crypto trading analyst. Always respond with valid JSON only. No markdown.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 600,
  });
  const text = (c.choices[0]?.message?.content ?? '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(text) as AISignal;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Body;
    if (!body.token) return NextResponse.json({ error: 'token required' }, { status: 400 });

    const { price, change } = await fetchLivePrice(body.token);

    // ── Fetch ALL live SoDEX market prices for full market snapshot ──
    let marketSnapshot = 'Market data unavailable.';
    let globalMcap = 'N/A';
    try {
      const allPricesRes = await getPrices();
      const allPricesData = await allPricesRes.json() as {
        prices?: Array<{ symbol: string; price: string; change: string; volume: string }>;
        globalMarketCap?: string;
        source?: string;
      };
      if (allPricesData.prices && allPricesData.prices.length > 0) {
        // Build a clean market table for the AI
        const top = allPricesData.prices.slice(0, 15);
        marketSnapshot = top.map(p => {
          const sym = p.symbol.replace('USDT','').replace('_vUSDC','').replace('v','');
          const ch = parseFloat(p.change) >= 0 ? `+${p.change}%` : `${p.change}%`;
          return `${sym.padEnd(8)} $${p.price.padStart(12)}  ${ch.padStart(8)}  Vol:${p.volume}`;
        }).join('\n');
      }
      if (allPricesData.globalMarketCap) globalMcap = allPricesData.globalMarketCap;
    } catch (e) {
      console.warn('Market snapshot fetch error:', e);
    }

    // Fetch latest news to inject into the prompt
    let newsContext = '';
    try {
      const newsRes = await fetch(`${req.nextUrl.origin}/api/news`);
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        newsContext = (newsData.news || [])
          .slice(0, 5)
          .map((n: any) => `- ${n.title} [${n.source}]`)
          .join('\n');
      }
    } catch (e) {
      console.warn('Could not fetch news context for AI:', e);
    }

    const prompt = buildPrompt(
      body.token.toUpperCase(),
      body.timeframe ?? '1H',
      body.riskProfile ?? 'Moderate',
      price,
      change,
      body.buyZone ?? '',
      body.sellZone ?? '',
      newsContext,
      marketSnapshot,
      globalMcap
    );


    let signal: AISignal;
    let modelUsed = 'gemini-2.5-flash';

    // ── Dual-AI: run Gemini primary, Groq fallback ────────────────────────
    try {
      signal = await runGemini(prompt);
    } catch (e1) {
      console.warn('Gemini failed, falling back to Groq (llama-3.3-70b):', e1);
      try {
        signal = await runGroq(prompt);
        modelUsed = 'llama-3.3-70b-versatile';
      } catch (e2: any) {
        console.error('All AI providers failed:', e2);
        return NextResponse.json({ error: 'AI Analysis unavailable: ' + e2.message, price, change }, { status: 502 });
      }
    }

    // ── Confidence guard: if confidence < 60, flag as low-conviction ──────
    if (signal.confidence < 60) {
      signal.reasoning = `[Low Conviction — ${signal.confidence}%] ` + signal.reasoning;
    }

    // NEW: SEND TELEGRAM ALERT IF CHAT ID PROVIDED
    if (body.chatId && process.env.TELEGRAM_BOT_TOKEN) {
      const msg = `🚀 <b>NEW AI SIGNAL</b>\n\n` +
                  `Asset: <b>${body.token.toUpperCase()}/USDT</b>\n` +
                  `Action: ${signal.signal === 'BUY' ? '🟢 <b>BUY</b>' : signal.signal === 'SELL' ? '🔴 <b>SELL</b>' : '🟡 <b>HOLD</b>'}\n` +
                  `Confidence: <b>${signal.confidence}%</b>\n` +
                  `Target: <b>${signal.target}</b>\n` +
                  `Stop Loss: <b>${signal.stopLoss}</b>\n\n` +
                  `<i>Reasoning: ${signal.reasoning}</i>\n\n` +
                  `<a href="http://localhost:3000/ai-analysis">Open Terminal →</a>`;
      
      try {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: body.chatId, text: msg, parse_mode: 'HTML' })
        });
      } catch (e) {
        console.error('Telegram Signal Send Error:', e);
      }
    }

    return NextResponse.json({ signal, model: modelUsed, price, change, generatedAt: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
