/**
 * Server-only Gemini helper. Never log the API key.
 * Free-tier friendly: fast model, 5min cache, rate-limit → rules fallback.
 * Supports structured JSON, optional Google Search grounding, and function calling.
 */
import { JARVIS_TOOL_DECLS, runJarvisTool } from '@/lib/gemini-tools';

export const GEMINI_FAST_MODEL = 'gemini-2.5-flash';

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

type CacheEntry = { at: number; value: string };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 5 * 60 * 1000;

export function cacheGet(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key: string, value: string) {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 40) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}

export class GeminiRateLimitError extends Error {
  constructor(message = 'Gemini rate limited') {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractJsonArray(text: string): unknown[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const v = JSON.parse(match[0]);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function mapErr(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (/429|rate|quota|RESOURCE_EXHAUSTED/i.test(msg)) throw new GeminiRateLimitError(msg.slice(0, 120));
  throw e instanceof Error ? e : new Error(msg);
}

/** Plain JSON generation (thesis / ideas). */
export async function geminiGenerate(opts: {
  prompt: string;
  cacheKey?: string;
  system?: string;
}): Promise<string> {
  if (!hasGeminiKey()) throw new Error('GEMINI_API_KEY missing');
  if (opts.cacheKey) {
    const hit = cacheGet(opts.cacheKey);
    if (hit) return hit;
  }
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
  try {
    const res = await client.models.generateContent({
      model: GEMINI_FAST_MODEL,
      contents: opts.prompt,
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        ...(opts.system ? { systemInstruction: opts.system } : {}),
      },
    });
    const text =
      (res as { text?: string }).text ??
      String((res as { response?: { text?: () => string } }).response?.text?.() ?? '');
    if (!text.trim()) throw new Error('Empty Gemini response');
    if (opts.cacheKey) cacheSet(opts.cacheKey, text);
    return text;
  } catch (e) {
    mapErr(e);
  }
}

export type GroundedSource = { title: string; uri: string };

/** Optional Google Search grounding (soft-fail if free tier rejects). */
export async function geminiGroundedBrief(opts: {
  prompt: string;
  cacheKey?: string;
}): Promise<{ text: string; sources: GroundedSource[]; grounded: boolean }> {
  if (!hasGeminiKey()) throw new Error('GEMINI_API_KEY missing');
  if (opts.cacheKey) {
    const hit = cacheGet(opts.cacheKey);
    if (hit) {
      try {
        return JSON.parse(hit) as { text: string; sources: GroundedSource[]; grounded: boolean };
      } catch {
        /* continue */
      }
    }
  }
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
  try {
    const res = await client.models.generateContent({
      model: GEMINI_FAST_MODEL,
      contents: opts.prompt,
      config: {
        temperature: 0.4,
        tools: [{ googleSearch: {} }],
      },
    });
    const text =
      (res as { text?: string }).text ??
      String((res as { response?: { text?: () => string } }).response?.text?.() ?? '');
    const meta = (res as { candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> } }> }).candidates?.[0]
      ?.groundingMetadata;
    const sources: GroundedSource[] = (meta?.groundingChunks ?? [])
      .map((c) => ({ title: c.web?.title || 'Source', uri: c.web?.uri || '' }))
      .filter((s) => s.uri)
      .slice(0, 8);
    const out = { text: text.trim(), sources, grounded: sources.length > 0 };
    if (opts.cacheKey) cacheSet(opts.cacheKey, JSON.stringify(out));
    return out;
  } catch (e) {
    // Free tier may reject googleSearch — fall through to plain generate
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|rate|quota|RESOURCE_EXHAUSTED/i.test(msg)) throw new GeminiRateLimitError(msg.slice(0, 120));
    const text = await geminiGenerate({
      prompt: opts.prompt + '\n\nReturn JSON: {"summary":"...","notes":"..."}',
      cacheKey: opts.cacheKey ? `${opts.cacheKey}:plain` : undefined,
      system: 'Return JSON only.',
    });
    return { text, sources: [], grounded: false };
  }
}

type ContentPart = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } };

/** Function-calling loop for Jarvis tools (max 4 rounds). */
export async function geminiWithTools(opts: {
  prompt: string;
  system?: string;
  cacheKey?: string;
  maxRounds?: number;
}): Promise<{ text: string; toolTrace: Array<{ name: string; ok: boolean }> }> {
  if (!hasGeminiKey()) throw new Error('GEMINI_API_KEY missing');
  if (opts.cacheKey) {
    const hit = cacheGet(opts.cacheKey);
    if (hit) {
      try {
        return JSON.parse(hit) as { text: string; toolTrace: Array<{ name: string; ok: boolean }> };
      } catch {
        /* */
      }
    }
  }
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
  const toolTrace: Array<{ name: string; ok: boolean }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [{ role: 'user', parts: [{ text: opts.prompt }] }];
  const maxRounds = opts.maxRounds ?? 4;

  try {
    for (let round = 0; round < maxRounds; round++) {
      const res = await client.models.generateContent({
        model: GEMINI_FAST_MODEL,
        contents,
        config: {
          temperature: 0.35,
          systemInstruction:
            opts.system ||
            'You are JARVIS for FlowSentinel. Use tools to read live data. Never place orders. Cite news by id. Return final answer as JSON.',
          tools: [{ functionDeclarations: JARVIS_TOOL_DECLS as unknown as never[] }],
        },
      });

      const candidate = (res as { candidates?: Array<{ content?: { parts?: ContentPart[] } }> }).candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall);
      if (!calls.length) {
        const text =
          (res as { text?: string }).text ??
          (parts.map((p) => p.text || '').join('\n') || '');
        const out = { text: text.trim(), toolTrace };
        if (opts.cacheKey) cacheSet(opts.cacheKey, JSON.stringify(out));
        return out;
      }

      contents.push({ role: 'model', parts });
      const fnParts: ContentPart[] = [];
      for (const part of calls) {
        const name = part.functionCall!.name;
        const args = (part.functionCall!.args || {}) as Record<string, unknown>;
        try {
          const response = await runJarvisTool(name, args);
          toolTrace.push({ name, ok: true });
          fnParts.push({ functionResponse: { name, response } });
        } catch (err) {
          toolTrace.push({ name, ok: false });
          fnParts.push({
            functionResponse: {
              name,
              response: { error: err instanceof Error ? err.message : String(err) },
            },
          });
        }
      }
      contents.push({ role: 'user', parts: fnParts });
    }
    return { text: '', toolTrace };
  } catch (e) {
    mapErr(e);
  }
}
