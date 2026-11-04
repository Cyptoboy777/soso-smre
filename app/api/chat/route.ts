import { NextResponse } from "next/server";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { geminiGenerate, hasGeminiKey } from "@/lib/gemini";
import { logServerError, publicErrorMessage } from "@/lib/public-errors";
import { readJsonBodyLimited } from "@/lib/builder-order-guard";
import { chunkForStream, sanitizeAssistantReply } from "@/lib/chat-reply";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM = `You are FlowSentinel Assistant, a friendly guide inside a SoSoValue + SoDEX trading desk app.
Help with: how the desk works, reading ETF flow ideas, practice trading, builder app fees, and live market context the app provides.
Rules:
- Never place, sign, or confirm orders. Users must confirm every trade themselves.
- When deskContext is provided, you MAY cite those live prices / ETF flows / today's idea. Do not invent other numbers.
- Never reveal server env vars, API keys, gateways, or internal config.
- Keep answers concise (under 90 words) unless the user asks for detail.
- Use plain markdown sparingly (short lists ok). No em dashes.
- Do NOT append "Not financial advice" to every reply (the panel footer already says it).
- If unsure, say so and suggest Start, Stats, or the Desk.`;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `chat:${ip}`,
    40,
    60 * 60_000,
    "Too many messages. Please wait a minute.",
  );
  if (limited) return limited;

  const parsed = await readJsonBodyLimited(req, 24_576);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 413 });
  }
  const body = parsed.value as {
    message?: string;
    history?: Array<{ role?: string; content?: string }>;
    stream?: boolean;
    deskContext?: {
      btcPrice?: number | null;
      ethPrice?: number | null;
      solPrice?: number | null;
      btcEtfFlow?: number | null;
      ethEtfFlow?: number | null;
      ideaSide?: string | null;
      ideaSymbol?: string | null;
      ideaSummary?: string | null;
    };
  };
  const message = String(body.message ?? "").trim().slice(0, 1200);
  if (!message) {
    return NextResponse.json({ error: "Type a message to continue." }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const historyText = history
    .map((h) => {
      const role = h.role === "assistant" ? "Assistant" : "User";
      const content = sanitizeAssistantReply(String(h.content ?? "")).slice(0, 400);
      return `${role}: ${content}`;
    })
    .join("\n");

  const ctx = body.deskContext ?? {};
  const ctxLines: string[] = [];
  if (ctx.btcPrice != null) ctxLines.push(`Live BTC (SoDEX): $${Number(ctx.btcPrice).toLocaleString()}`);
  if (ctx.ethPrice != null) ctxLines.push(`Live ETH (SoDEX): $${Number(ctx.ethPrice).toLocaleString()}`);
  if (ctx.solPrice != null) ctxLines.push(`Live SOL (SoDEX): $${Number(ctx.solPrice).toLocaleString()}`);
  if (ctx.btcEtfFlow != null) {
    const v = Number(ctx.btcEtfFlow);
    ctxLines.push(`BTC US ETF net ${v >= 0 ? "inflow" : "outflow"}: $${Math.abs(v).toLocaleString()}`);
  }
  if (ctx.ethEtfFlow != null) {
    const v = Number(ctx.ethEtfFlow);
    ctxLines.push(`ETH US ETF net ${v >= 0 ? "inflow" : "outflow"}: $${Math.abs(v).toLocaleString()}`);
  }
  if (ctx.ideaSide || ctx.ideaSummary) {
    ctxLines.push(
      `Today's idea: ${ctx.ideaSide ?? "n/a"} ${ctx.ideaSymbol ?? ""} - ${String(ctx.ideaSummary ?? "").slice(0, 180)}`.replace(
        /\u2014/g,
        "-",
      ),
    );
  }
  const deskBlock = ctxLines.length ? `Desk context (live from app):\n${ctxLines.join("\n")}\n\n` : "";

  const wantStream = body.stream !== false;

  try {
    let reply: string;
    if (!hasGeminiKey()) {
      reply =
        "I can still help at a high level: open Start to connect your wallet, review an idea on the Desk, then confirm any practice trade yourself. Live AI answers need the assistant key on this deploy.";
    } else {
      const prompt = `${deskBlock}${historyText ? `Recent chat:\n${historyText}\n\n` : ""}User: ${message}\n\nReply as FlowSentinel Assistant in plain text (not JSON).`;
      const text = await geminiGenerate({
        prompt,
        system: SYSTEM,
        format: "text",
        temperature: 0.45,
        cacheKey: `chat:v2:${message.slice(0, 60)}:${ctx.btcPrice ?? ""}:${ctx.ideaSide ?? ""}`,
      });
      reply = sanitizeAssistantReply(text);
    }
    if (!reply) {
      reply = "I could not form a reply. Try asking how to start a practice trade.";
    }

    const suggestions = [
      "What is today's BTC price?",
      "Explain today's idea simply",
      "How do I take a practice trade?",
    ];

    if (!wantStream) {
      return NextResponse.json({ reply, suggestions });
    }

    const encoder = new TextEncoder();
    const chunks = chunkForStream(reply, 14);
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        send({ type: "start" });
        for (const c of chunks) {
          send({ type: "token", text: c });
          await new Promise((r) => setTimeout(r, 12));
        }
        send({ type: "done", reply, suggestions });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    logServerError("chat", e);
    return NextResponse.json(
      { error: publicErrorMessage(e, "The assistant is busy. Please try again shortly.") },
      { status: 502 },
    );
  }
}
