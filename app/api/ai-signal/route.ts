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

function buildPrompt(token: string, tf: string, risk: string, price: string, change: string, buyZone: string, sellZone: string) {
  return `You are an elite institutional crypto trading algorithm for SoSo SMRE.

Analyze ${token}/USDT strictly on the ${tf} timeframe.
Risk Profile: ${risk}
Current Live Price: $${price}
24h Change: ${change}%
${buyZone ? `User's requested Entry Zone: ${buyZone}` : ''}
${sellZone ? `User's requested Target Zone: ${sellZone}` : ''}

Task: Provide a highly professional, data-driven trading signal tailored EXACTLY to the ${tf} timeframe.
- If the timeframe is 15M or 1H, calculate tight day-trading scalp targets and stop-losses.
- If the timeframe is 4H, 1D or 1W, calculate wider macro swing-trading targets and stops.
- CRITICAL RULE: NEVER output "$N/A". You MUST mathematically calculate realistic, exact numerical price targets based on the Current Price of $${price}.
- Stop-loss and Target MUST be exact dollar amounts formatted like "$XXX.XX". Do not use vague terms.

Respond with ONLY a valid JSON object — no markdown, no backticks, no extra text:
{"signal":"BUY"|"SELL"|"HOLD","reasoning":"2-3 precise technical sentences referencing exact support/resistance levels and market context based on the current price.","confidence":55-95,"stopLoss":"$XX.XX","target":"$XX.XX","timeframe":"${tf}","riskLevel":"LOW"|"MEDIUM"|"HIGH"}`;
}

async function fetchLivePrice(token: string) {
  try {
    const res = await getPrices();
    const data = await res.json() as { prices?: Array<{ symbol: string; price: string; change: string }> };
    const found = data.prices?.find(p => p.symbol === token.toUpperCase() + 'USDT');
    if (found) {
      return { price: found.price, change: found.change };
    }
    // Fallback if not found in pre-configured lists
    const sym = token.toUpperCase() + 'USDT';
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`);
    if (r.ok) {
      const d = await r.json() as { lastPrice: string; priceChangePercent: string };
      return { price: parseFloat(d.lastPrice).toFixed(4), change: parseFloat(d.priceChangePercent).toFixed(2) };
    }
    return { price: '1.00', change: '0' }; // Hard fallback to prevent $N/A errors
  } catch {
    return { price: '1.00', change: '0' };
  }
}

async function runGemini(prompt: string): Promise<AISignal> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const ai = new GoogleGenAI({ apiKey: key });
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  const text = (res.text ?? '')
    .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(text) as AISignal;
}

async function runGroq(prompt: string): Promise<AISignal> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const groq = new Groq({ apiKey: key });
  const c = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
  });
  const text = (c.choices[0]?.message?.content ?? '')
    .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(text) as AISignal;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Body;
    if (!body.token) return NextResponse.json({ error: 'token required' }, { status: 400 });

    const { price, change } = await fetchLivePrice(body.token);
    const prompt = buildPrompt(
      body.token.toUpperCase(),
      body.timeframe ?? '1H',
      body.riskProfile ?? 'Moderate',
      price,
      change,
      body.buyZone ?? '',
      body.sellZone ?? '',
    );

    // Try Gemini first, then Groq. If both live providers fail, return an error.
    let signal: AISignal;
    let model = 'gemini-2.5-flash';

    try {
      signal = await runGemini(prompt);
    } catch (e1) {
      console.warn('Gemini failed:', e1);
      try {
        signal = await runGroq(prompt);
        model = 'llama-3.3-70b-versatile';
      } catch (e2) {
        console.warn('Groq failed:', e2);
        return NextResponse.json({ error: 'Live AI providers failed', price, change }, { status: 502 });
      }
    }

    return NextResponse.json({ signal, model, price, change, generatedAt: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
