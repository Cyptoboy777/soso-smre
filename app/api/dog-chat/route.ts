import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const groqClient   = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

// ── in-memory rate limit (per-IP, max 20 req/min) ─────────────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now  = Date.now();
  const slot = rateMap.get(ip) ?? { count: 0, resetAt: now + 60_000 };
  if (now > slot.resetAt) { slot.count = 0; slot.resetAt = now + 60_000; }
  slot.count++;
  rateMap.set(ip, slot);
  return slot.count > 20;
}

export async function POST(req: Request) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ reply: 'Woof! Too many questions! Slow down, fren 🐕' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { message, context, history, prices, news } = body;

    if (!message?.trim()) {
      return NextResponse.json({ reply: 'Woof? You sent me nothing!' }, { status: 400 });
    }

    // Build the system prompt — supports both SoEva context and SoDoggy context
    const systemPrompt = context ?? `You are "SoDoggy", the official futuristic Cyberpunk Shiba Inu Crypto Analyst of SoSo SMRE.
You are smart, witty, and helpful. You speak like a dog sometimes (e.g., "Woof!", "Bork!").
CURRENT MARKET DATA: ${JSON.stringify(prices ?? {})}
RECENT NEWS: ${JSON.stringify((news ?? []).slice(0, 5))}
Keep replies concise (max 4 sentences). Always end with a short disclaimer if giving trading advice.`;

    // Build message history for multi-turn
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(history ?? []),
      { role: 'user', content: message },
    ];

    let text = '';

    try {
      // ── Primary: Gemini 2.5 Flash (multi-turn via contents array) ─────────
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      // Prepend system as first user turn if no history
      if (!history?.length) {
        contents.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
        contents.unshift({ role: 'model', parts: [{ text: 'Understood. Ready.' }] });
      }

      const result = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
      });
      text = result.text ?? '';
    } catch (e: any) {
      console.warn('Gemini failed → Groq fallback:', e.message);
      // ── Fallback: Groq llama-3.3-70b-versatile ────────────────────────────
      const groqMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];
      const completion = await groqClient.chat.completions.create({
        messages: groqMessages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 400,
      });
      text = completion.choices[0]?.message?.content ?? '';
    }

    if (!text) throw new Error('No response from AI providers');

    return NextResponse.json({ reply: text });
  } catch (e: any) {
    console.error('dog-chat error:', e);
    return NextResponse.json({
      reply: `Woof! My neural link is fried. (${e.message ?? 'Unknown error'}) Try again!`,
    }, { status: 500 });
  }
}
