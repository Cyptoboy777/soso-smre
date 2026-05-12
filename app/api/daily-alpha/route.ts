import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST() {
  try {
    // 1. Fetch real prices
    const priceRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/prices`);
    const priceData = await priceRes.json() as { prices?: Array<{ symbol: string; price: string; change: string; rawPrice: number }> };
    const prices = priceData.prices ?? [];

    // 2. Find top gainers (sorted by 24h change desc)
    const gainers = [...prices]
      .filter(p => p.symbol !== 'SOSOUSDT')
      .sort((a, b) => parseFloat(b.change) - parseFloat(a.change))
      .slice(0, 5);

    // 3. Fetch news headlines
    let newsHeadlines = '';
    try {
      const newsRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/news`);
      const newsData = await newsRes.json() as { news?: Array<{ title: string }> };
      newsHeadlines = (newsData.news ?? []).slice(0, 5).map((n, i) => `${i + 1}. ${n.title}`).join('\n');
    } catch {}

    // 4. Ask Gemini to pick best tokens with reasoning
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const prompt = `You are an elite institutional crypto research analyst for SoSo SMRE platform.

Today's Date/Time (IST): ${now}

TOP 5 GAINERS RIGHT NOW (Live 24H Data):
${gainers.map(g => `- ${g.symbol.replace('USDT','')}: $${g.price} (${parseFloat(g.change) >= 0 ? '+' : ''}${g.change}%)`).join('\n')}

LATEST CRYPTO NEWS:
${newsHeadlines || 'No news available'}

TASK: Based on the live price momentum AND the news context above, select the TOP 3 tokens that are the BEST BUY opportunities RIGHT NOW for today.

For each token provide:
1. Why to buy it (specific technical + news reason)
2. Entry price range
3. Target price
4. Stop-loss
5. Risk level (LOW/MEDIUM/HIGH)

Also provide 1 token to AVOID with reason.

Respond in this EXACT JSON format (no markdown, no backticks):
{
  "marketMood": "Bullish|Bearish|Neutral",
  "summary": "One line market summary",
  "buys": [
    {"symbol":"BTC","entryRange":"$X - $Y","target":"$Z","stopLoss":"$W","riskLevel":"MEDIUM","reason":"..."},
    {"symbol":"ETH","entryRange":"$X - $Y","target":"$Z","stopLoss":"$W","riskLevel":"LOW","reason":"..."},
    {"symbol":"SOL","entryRange":"$X - $Y","target":"$Z","stopLoss":"$W","riskLevel":"MEDIUM","reason":"..."}
  ],
  "avoid": {"symbol":"TOKEN","reason":"..."},
  "dyor": "This is AI research, not financial advice. Always DYOR."
}`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);

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
