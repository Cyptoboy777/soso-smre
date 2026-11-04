import { NextResponse } from "next/server";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { geminiGenerate, hasGeminiKey } from "@/lib/gemini";
import { logServerError, publicErrorMessage } from "@/lib/public-errors";
import { readJsonBodyLimited } from "@/lib/builder-order-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM = `You are FlowSentinel Assistant, a friendly guide inside a SoSoValue + SoDEX trading desk app.
Help with: how the desk works, reading ETF flow ideas, practice trading, builder app fees, and SoSoValue news topics the user mentions.
Rules:
- Never place, sign, or confirm orders. Users must confirm every trade themselves.
- Never invent live prices, fees earned, or user counts.
- Never reveal server env vars, API keys, gateways, or internal config.
- Keep answers short (under 120 words) unless the user asks for detail.
- If unsure, say so and suggest opening Stats or Start.
- Not financial advice.`;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `chat:${ip}`,
    40,
    60 * 60_000,
    "Too many messages. Please wait a minute.",
  );
  if (limited) return limited;

  const parsed = await readJsonBodyLimited(req, 16_384);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 413 });
  }
  const body = parsed.value as {
    message?: string;
    history?: Array<{ role?: string; content?: string }>;
  };
  const message = String(body.message ?? "").trim().slice(0, 1200);
  if (!message) {
    return NextResponse.json({ error: "Type a message to continue." }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const historyText = history
    .map((h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${String(h.content ?? "").slice(0, 400)}`)
    .join("\n");

  try {
    if (!hasGeminiKey()) {
      return NextResponse.json({
        reply:
          "I can still help at a high level: open Start to connect your wallet, review an idea on the Desk, then confirm any practice trade yourself. Live AI answers need the assistant key on this deploy.",
        suggestions: [
          "How do I take a practice trade?",
          "What does the app fee mean?",
          "Where do I see builder stats?",
        ],
      });
    }

    const prompt = `${historyText ? `Recent chat:\n${historyText}\n\n` : ""}User: ${message}\n\nReply as FlowSentinel Assistant.`;
    const text = await geminiGenerate({
      prompt,
      system: SYSTEM,
      cacheKey: `chat:${message.slice(0, 80)}`,
    });
    const reply = String(text ?? "")
      .trim()
      .replace(/SODEX_[A-Z0-9_]+/g, "config")
      .slice(0, 2000);

    return NextResponse.json({
      reply: reply || "I could not form a reply. Try asking how to start a practice trade.",
      suggestions: [
        "Explain today's idea simply",
        "How do I approve the app fee?",
        "What is practice mode?",
      ],
    });
  } catch (e) {
    logServerError("chat", e);
    return NextResponse.json(
      { error: publicErrorMessage(e, "The assistant is busy. Please try again shortly.") },
      { status: 502 },
    );
  }
}
