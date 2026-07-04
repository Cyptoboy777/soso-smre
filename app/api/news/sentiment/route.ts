import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface NewsItemInput {
  id: string;
  title: string;
  summary: string;
}

export async function POST(req: NextRequest) {
  try {
    const { news } = await req.json() as { news: NewsItemInput[] };
    if (!Array.isArray(news) || news.length === 0) {
      return NextResponse.json({ error: 'No news articles provided' }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const client = new GoogleGenAI({ apiKey: key });

    // Build prompt with the list of headlines
    const listStr = news.map((n) => `[ID: ${n.id}] Title: ${n.title}\nSummary: ${n.summary}`).join('\n\n');

    const prompt = `You are a financial analyst specializing in crypto markets.
Analyze the sentiment of the following news articles. For each article, classify the sentiment as "Positive", "Neutral", or "Negative" based on its likely impact on the crypto market. Also provide a confidence score from 60 to 100 percent.

Return a clean JSON array of objects, with NO markdown formatting (no \`\`\`json blocks), in this exact format:
[
  { "id": "article_id", "sentiment": "Positive" | "Neutral" | "Negative", "score": 85 }
]

Articles:
${listStr}`;

    const res = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = (res.text ?? '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let sentiments;
    try {
      sentiments = JSON.parse(text);
    } catch {
      // Fallback if parsing failed or extra text was included
      const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        sentiments = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse sentiment response from Gemini: ' + text);
      }
    }

    return NextResponse.json({ sentiments });
  } catch (e: any) {
    console.error('Sentiment Analysis Error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
