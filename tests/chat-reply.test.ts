import { describe, expect, it } from 'vitest';
import { chunkForStream, extractAssistantText, sanitizeAssistantReply } from '../lib/chat-reply';
import { filterBookLevels } from '../lib/sodex-market';

describe('chat reply parsing', () => {
  it('unwraps role/content JSON strings', () => {
    const raw = JSON.stringify({
      role: 'assistant',
      content: 'BTC is near 78,400 on live SoDEX prices.',
    });
    expect(extractAssistantText(raw)).toBe('BTC is near 78,400 on live SoDEX prices.');
  });

  it('unwraps reply field and markdown fences', () => {
    const raw = '```json\n{"reply":"Practice mode keeps orders offline."}\n```';
    expect(sanitizeAssistantReply(raw)).toBe('Practice mode keeps orders offline.');
  });

  it('strips em dashes and disclaimer tags', () => {
    const raw = 'Use Start to connect — then confirm. Not financial advice!';
    const out = sanitizeAssistantReply(raw);
    expect(out).not.toMatch(/\u2014/);
    expect(out.toLowerCase()).not.toContain('not financial advice');
    expect(out).toContain('Start');
  });

  it('chunks for streaming', () => {
    const chunks = chunkForStream('Hello world from FlowSentinel', 8);
    expect(chunks.join('')).toBe('Hello world from FlowSentinel');
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('orderbook filter', () => {
  it('drops far junk levels around mid', () => {
    const mid = 78400;
    const levels = [
      { price: 78390, qty: 1 },
      { price: 50000, qty: 9 },
      { price: 1101, qty: 2 },
      { price: 78200, qty: 1 },
    ];
    const out = filterBookLevels(levels, mid, 'bid', 0.04);
    expect(out.every((l) => l.price > 75000)).toBe(true);
    expect(out.some((l) => l.price === 50000)).toBe(false);
  });
});
