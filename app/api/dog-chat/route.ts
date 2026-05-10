import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

export async function POST(req: Request) {
  try {
    const { message, news, prices } = await req.json();

    const prompt = `
      You are "SoDoggy", the official futuristic Cyberpunk Shiba Inu Crypto Analyst of SoSo SMRE. 
      You are directly connected to the SoDEX Mainnet and use official SoDEX SDKs for high-precision analysis.
      You are smart, witty, and helpful. You speak like a dog sometimes (e.g., "Woof!", "Bork!").
      
      CURRENT SODEX MARKET DATA:
      Prices: ${JSON.stringify(prices)}
      Recent News: ${JSON.stringify(news)}

      USER QUESTION: "${message}"

      TASK:
      1. Analyze the user's question based on the provided real-time SoDEX market data.
      2. Give a genuine, data-driven reply. 
      3. If they ask about trading, reference SoDEX-specific price levels.
      4. Always maintain the persona of SoDoggy.
      5. Keep it concise (max 3-4 sentences).
    `;

    let text = "";

    try {
      // Primary: Gemini 2.5 Flash
      const result = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      text = result.text || "";
    } catch (e: any) {
      console.warn("Gemini Failed, switching to Groq:", e.message);
      // Secondary: Groq Fallback (llama-3.1-8b-instant)
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 500,
      });
      text = chatCompletion.choices[0]?.message?.content || "";
    }

    if (!text) throw new Error("No response from AI providers");

    return NextResponse.json({ reply: text });
  } catch (e: any) {
    console.error("All AI Providers Failed:", e);
    return NextResponse.json({ 
      reply: "Woof! My neural link is totally fried. Even my backups are down! Try again later. (Error: " + (e.message || "API Issue") + ")" 
    });
  }
}
