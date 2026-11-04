/**
 * Normalize assistant model output into plain chat text.
 */
import { sanitizePublicText } from '@/lib/display';

export function extractAssistantText(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw !== 'string') {
    if (typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      for (const k of ['content', 'reply', 'text', 'message', 'summary']) {
        if (typeof o[k] === 'string' && o[k]) return extractAssistantText(o[k]);
      }
    }
    return String(raw);
  }
  let text = raw.trim();
  // Strip markdown fences
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) text = fence[1].trim();

  if (
    (text.startsWith('{') && text.endsWith('}')) ||
    (text.startsWith('[') && text.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed === 'string') return extractAssistantText(parsed);
      if (Array.isArray(parsed)) {
        const parts = parsed
          .map((p) => extractAssistantText(p))
          .filter(Boolean);
        if (parts.length) return parts.join('\n');
      }
      if (parsed && typeof parsed === 'object') {
        const o = parsed as Record<string, unknown>;
        for (const k of ['content', 'reply', 'text', 'message', 'summary', 'answer']) {
          if (typeof o[k] === 'string' && String(o[k]).trim()) {
            return extractAssistantText(o[k]);
          }
        }
        // { role, content } shape
        if (typeof o.role === 'string' && typeof o.content === 'string') {
          return extractAssistantText(o.content);
        }
      }
    } catch {
      /* keep raw */
    }
  }
  return text;
}

export function sanitizeAssistantReply(raw: string): string {
  let text = sanitizePublicText(extractAssistantText(raw));
  // No em dashes in UI copy
  text = text.replace(/\u2014/g, ',').replace(/\u2013/g, '-');
  // Drop repeated disclaimer lines (panel footer covers this once)
  text = text
    .split('\n')
    .filter((line) => !/^\s*not financial advice[!?.]*\s*$/i.test(line))
    .join('\n');
  text = text.replace(/\s*\(?\s*not financial advice\s*\)?\s*[.!]?/gi, ' ');
  text = text.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return text.slice(0, 2500);
}

/** Split into small chunks for SSE token streaming. */
export function chunkForStream(text: string, size = 12): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      const sp = text.lastIndexOf(' ', end);
      if (sp > i + 3) end = sp + 1;
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out.length ? out : [''];
}
