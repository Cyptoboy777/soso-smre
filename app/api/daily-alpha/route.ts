import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

export async function POST(req: Request) {
  try {
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // 1. Fetch real prices
    const priceRes = await fetch(`${baseUrl}/api/prices`);
    const priceData = await priceRes.json() as { prices?: Array<{ symbol: string; price: string; change: string; rawPrice: number }> };
    const prices = priceData.prices ?? [];

    // 2. Find top gainers
    const gainers = [...prices]
      .filter(p => p.symbol !== 'SOSOUSDT')
      .sort((a, b) => parseFloat(b.change) - parseFloat(a.change))
      .slice(0, 5);

    // 3. Fetch news headlines
    let newsHeadlines = '';
    try {
      const newsRes = await fetch(`${baseUrl}/api/news`);
      const newsData = await newsRes.json() as { news?: Array<{ title: string }> };
      newsHeadlines = (newsData.news ?? []).slice(0, 5).map((n, i) => `${i + 1}. ${n.title}`).join('\n');
    } catch {}

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const prompt = `You are an elite institutional crypto research analyst for SoSo SMRE platform.
Today's Date/Time (IST): ${now}
TOP 5 GAINERS RIGHT NOW:
${gainers.map(g => `- ${g.symbol.replace('USDT','')}: $${g.price} (${parseFloat(g.change) >= 0 ? '+' : ''}${g.change}%)`).join('\n')}
LATEST CRYPTO NEWS:
${newsHeadlines || 'No news available'}
TASK: Based on momentum and news, select TOP 3 best buy opportunities for today.
Respond in this EXACT JSON format:
{
  "marketMood": "Bullish|Bearish|Neutral",
  "summary": "One line summary",
  "buys": [{"symbol":"BTC","entryRange":"$X","target":"$Z","stopLoss":"$W","riskLevel":"MEDIUM","reason":"..."}],
  "avoid": {"symbol":"TOKEN","reason":"..."},
  "dyor": "DYOR."
}`;

    let analysis;
    let usedAI = 'Gemini';

    try {
      // 4a. Primary: Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      const raw = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const clean = raw.replace(/```json|```/g, '').trim();
      analysis = JSON.parse(clean);
    } catch (geminiError) {
      console.warn("Gemini failed, switching to Groq fallback:", geminiError);
      // 4b. Fallback: Groq (LLaMA 3.1)
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? '' });
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        max_tokens: 1000,
      });
      const raw = completion.choices[0]?.message?.content ?? '';
      const clean = raw.replace(/```json|```/g, '').trim();
      analysis = JSON.parse(clean);
      usedAI = 'Groq (Fallback)';
    }

    // 5. Format Telegram message
    const moodEmoji = analysis.marketMood === 'Bullish' ? '🟢' : analysis.marketMood === 'Bearish' ? '🔴' : '🟡';
    const lines = [
      `🚀 <b>SoSo SMRE — Today's Alpha Report</b>`,
      `📅 ${now} IST`,
      ``,
      `${moodEmoji} <b>Market Mood: ${analysis.marketMood}</b>`,
      `<i>${analysis.summary}</i>`,
      ``,
      `🎯 <b>TOP BUY SIGNALS TODAY</b>`,
      ...(analysis.buys ?? []).map((b: any, i: number) => [
        ``,
        `${i + 1}️⃣ <b>${b.symbol}/USDT</b> — Risk: ${b.riskLevel}`,
        `   📍 Entry: ${b.entryRange}`,
        `   🎯 Target: ${b.target}   🛑 Stop: ${b.stopLoss}`,
        `   📝 ${b.reason}`,
      ].join('\n')),
      ``,
      `❌ <b>AVOID TODAY</b>`,
      `   <b>${analysis.avoid?.symbol}</b>: ${analysis.avoid?.reason}`,
      ``,
      `⚠️ <i>${analysis.dyor}</i>`,
      ``,
      `📊 Powered by SoSo SMRE × SoSoValue × Gemini AI`,
    ];

    return NextResponse.json({
      ok: true,
      analysis,
      message: lines.join('\n'),
      generatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Alpha engine failed' },
      { status: 500 }
    );
  }
}
