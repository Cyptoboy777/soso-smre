import { lifiQuote, lifiStatus } from './lifi';
import { relayQuote, relayStatus } from './relay';
import type { NormalizedQuote, NormalizedStatus, QuoteInput, RouteProvider } from './types';

export type QuoteEnv = {
  fetch: typeof fetch;
  relayApiKey?: string;
  feeBps?: number;
  feeRecipient?: string;
  timeoutMs?: number;
};

/** Relay first when a server key is present; otherwise, or on Relay failure, LI.FI (no key required). */
export async function getNormalizedQuote(input: QuoteInput, env: QuoteEnv): Promise<NormalizedQuote | { error: string }> {
  const fee = env.feeBps && env.feeBps > 0 && env.feeRecipient
    ? { bps: env.feeBps, recipient: env.feeRecipient }
    : undefined;
  if (env.relayApiKey) {
    try {
      const q = await relayQuote(input, { fetch: env.fetch, apiKey: env.relayApiKey, timeoutMs: env.timeoutMs }, fee);
      if (q) return q;
    } catch {
      // fall through to LI.FI; never surface the provider error
    }
  }
  try {
    const feeFraction = fee ? fee.bps / 10_000 : undefined;
    const q = await lifiQuote(input, { fetch: env.fetch, timeoutMs: env.timeoutMs, feeFraction });
    if (q) return q;
  } catch {
    // friendly message below
  }
  return { error: 'No route found right now. Try another amount or token.' };
}

export async function getNormalizedStatus(opts: {
  provider: RouteProvider;
  id: string;
  fromChain?: number;
  toChain?: number;
}, env: QuoteEnv): Promise<NormalizedStatus | { error: string }> {
  try {
    if (opts.provider === 'relay') {
      if (!env.relayApiKey) return { error: 'Could not check that route right now.' };
      const s = await relayStatus(opts.id, { fetch: env.fetch, apiKey: env.relayApiKey, timeoutMs: env.timeoutMs });
      if (s) return s;
    } else {
      const s = await lifiStatus(opts.id, { fetch: env.fetch, timeoutMs: env.timeoutMs }, { fromChain: opts.fromChain, toChain: opts.toChain });
      if (s) return s;
    }
  } catch {
    // friendly message
  }
  return { error: 'Could not check that route right now.' };
}

export function readFeeEnv(env: NodeJS.ProcessEnv = process.env): { bps: number; recipient?: string } {
  const raw = env.NEXT_PUBLIC_ROUTE_FEE_BPS ?? '0';
  const bps = Number(raw);
  const recipient = env.ROUTE_FEE_RECIPIENT;
  if (!Number.isInteger(bps) || bps <= 0) return { bps: 0 };
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) return { bps: 0 };
  return { bps, recipient };
}
