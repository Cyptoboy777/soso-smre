import { findAsset, isAllowedDestination, isEvmSodexChain } from '../sodexConfig';
import { isQuoteChainId, tokenByAddress } from './tokens';
import { FRIENDLY_BAD_INPUT, FRIENDLY_BAD_RECIPIENT, type QuoteInput } from './types';

export const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
export const AMOUNT_RE = /^\d+$/;
export const REQUEST_ID_RE = /^[0-9a-zA-Zx_-]{8,100}$/;

export type Validated = { ok: true; value: QuoteInput } | { ok: false; status: number; error: string };

export function isEvmAddress(s: unknown): s is string {
  return typeof s === 'string' && ADDR_RE.test(s);
}

export function validateQuoteBody(body: unknown): Validated {
  if (!body || typeof body !== 'object') return fail(400, FRIENDLY_BAD_INPUT);
  const b = body as Record<string, unknown>;
  if (!isEvmAddress(b.user) || !isEvmAddress(b.recipient)) return fail(400, FRIENDLY_BAD_INPUT);
  if (b.recipient.toLowerCase() !== b.user.toLowerCase()) return fail(400, FRIENDLY_BAD_RECIPIENT);

  const originChainId = toId(b.originChainId);
  const destinationChainId = toId(b.destinationChainId);
  if (originChainId == null || destinationChainId == null) return fail(400, FRIENDLY_BAD_INPUT);
  if (!isQuoteChainId(originChainId) || !isQuoteChainId(destinationChainId)) return fail(400, FRIENDLY_BAD_INPUT);

  if (typeof b.originCurrency !== 'string' || !ADDR_RE.test(b.originCurrency)) return fail(400, FRIENDLY_BAD_INPUT);
  if (typeof b.destinationCurrency !== 'string' || !ADDR_RE.test(b.destinationCurrency)) return fail(400, FRIENDLY_BAD_INPUT);
  if (typeof b.amount !== 'string' || !AMOUNT_RE.test(b.amount) || b.amount === '0') return fail(400, FRIENDLY_BAD_INPUT);

  const purpose = b.purpose === 'onward' ? 'onward' : 'fund';
  const destinationToken = typeof b.destinationToken === 'string' ? b.destinationToken : tokenByAddress(destinationChainId, b.destinationCurrency)?.symbol;
  const destinationSodexChain = typeof b.destinationSodexChain === 'string' ? b.destinationSodexChain : undefined;
  if (!destinationToken) return fail(400, FRIENDLY_BAD_INPUT);
  if (purpose === 'fund') {
    if (!destinationSodexChain) return fail(400, FRIENDLY_BAD_INPUT);
    if (!isEvmSodexChain(destinationSodexChain) || !isAllowedDestination(destinationToken, destinationSodexChain)) {
      const hint = findAsset(destinationToken, 'BASE') || findAsset('USDC', 'BASE');
      const choose = hint ? `${hint.token} on ${hint.chain}` : 'a supported token and chain';
      return fail(400, `SoDEX will not credit this. Choose ${choose} instead.`);
    }
  }
  const originToken = typeof b.originToken === 'string' ? b.originToken : (tokenByAddress(originChainId, b.originCurrency)?.symbol ?? 'TOKEN');

  return {
    ok: true,
    value: {
      user: b.user,
      recipient: b.recipient,
      originChainId,
      destinationChainId,
      originCurrency: b.originCurrency,
      destinationCurrency: b.destinationCurrency,
      amount: b.amount,
      originToken,
      destinationToken,
      destinationSodexChain: destinationSodexChain ?? '',
      purpose,
    },
  };
}

export function validateRequestId(id: unknown): id is string {
  return typeof id === 'string' && REQUEST_ID_RE.test(id);
}

export function validateTxHash(id: unknown): id is string {
  return typeof id === 'string' && /^0x[0-9a-fA-F]{16,80}$/.test(id);
}

function toId(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

function fail(status: number, error: string): Validated {
  return { ok: false, status, error };
}
