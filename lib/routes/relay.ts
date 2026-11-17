import { fromSmallest } from './amount';
import type { NormalizedQuote, NormalizedStatus, QuoteInput, RouteStep } from './types';

export const RELAY_API = 'https://api.relay.link';

export type RelayDeps = { fetch: typeof fetch; apiKey: string; timeoutMs?: number };

function timeoutSignal(ms: number) {
  return AbortSignal.timeout(ms);
}

export async function relayQuote(input: QuoteInput, deps: RelayDeps, fee?: { bps: number; recipient: string }): Promise<NormalizedQuote | null> {
  const body: Record<string, unknown> = {
    user: input.user,
    recipient: input.recipient,
    originChainId: input.originChainId,
    destinationChainId: input.destinationChainId,
    originCurrency: input.originCurrency,
    destinationCurrency: input.destinationCurrency,
    amount: input.amount,
    tradeType: 'EXACT_INPUT',
  };
  if (fee && fee.bps > 0 && fee.recipient) {
    body.appFees = [{ recipient: fee.recipient, fee: String(fee.bps) }];
  }
  const r = await deps.fetch(`${RELAY_API}/quote/v2`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': deps.apiKey, accept: 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutSignal(deps.timeoutMs ?? 10_000),
  });
  if (!r.ok) return null;
  let json: unknown;
  try { json = await r.json(); } catch { return null; }
  return normalizeRelayQuote(json, input, fee?.bps ?? 0);
}

export function normalizeRelayQuote(json: unknown, input: QuoteInput, appFeeBps = 0): NormalizedQuote | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as any;
  const rawSteps: any[] = Array.isArray(j.steps) ? j.steps : [];
  const steps: RouteStep[] = [];
  for (const s of rawSteps) {
    const kind = s?.kind === 'signature' ? 'signature' : s?.kind === 'transaction' ? 'transaction' : null;
    if (!kind) continue;
    const items: any[] = Array.isArray(s.items) ? s.items : [];
    for (const item of items) {
      const d = item?.data ?? {};
      const chainId = Number(d.chainId ?? s.chainId ?? input.originChainId);
      if (kind === 'transaction') {
        if (typeof d.to !== 'string') continue;
        steps.push({
          kind: 'transaction',
          chainId,
          action: String(s.action ?? 'Confirm the transaction'),
          description: String(s.description ?? 'Send the route transaction from your wallet.'),
          tx: {
            from: typeof d.from === 'string' ? d.from : input.user,
            to: d.to,
            data: typeof d.data === 'string' ? d.data : '0x',
            value: toHexValue(d.value),
            chainId,
            gas: d.gas ? String(d.gas) : undefined,
            gasPrice: d.gasPrice ? String(d.gasPrice) : undefined,
          },
        });
      } else {
        const sign = d.sign ?? d;
        const sigKind = String(sign.signatureKind ?? sign.kind ?? '').toLowerCase();
        steps.push({
          kind: 'signature',
          chainId,
          action: String(s.action ?? 'Sign the message'),
          description: String(s.description ?? 'Sign this message in your wallet. Nothing is sent until you approve.'),
          signature: {
            kind: sigKind.includes('712') ? 'eip712' : sigKind.includes('191') || sigKind.includes('personal') ? 'eip191' : 'unknown',
            message: typeof sign.message === 'string' ? sign.message : undefined,
            typedData: typeof sign.typedData === 'string' ? sign.typedData : (sign.types ? JSON.stringify(sign) : undefined),
          },
        });
      }
    }
  }
  if (!steps.length) return null;
  const details = j.details ?? {};
  const out = details.currencyOut ?? details.out ?? {};
  const currency = out.currency ?? {};
  const decimals = Number(currency.decimals ?? 18) || 18;
  const raw = String(out.amount ?? out.amountFormatted ?? '');
  const rawMin = String(out.minimumAmount ?? out.minAmount ?? raw);
  const outAmountRaw = /^\d+$/.test(raw) ? raw : '0';
  const minOutRaw = /^\d+$/.test(rawMin) ? rawMin : outAmountRaw;
  const feeUsd = pickUsd(j.fees?.relayer?.amountUsd ?? j.fees?.relayer?.usd ?? details.totalImpact?.usd ?? details.feeUsd);
  const appFeeUsd = pickUsd(details.expandedPriceImpact?.app?.usd ?? j.fees?.app?.amountUsd ?? j.fees?.app?.usd);
  const etaSec = pickNum(details.timeEstimate ?? details.estimatedTime ?? j.fees?.timeEstimate);
  const requestId = typeof details.currencyOut?.id === 'string' ? undefined : undefined;
  const id = typeof j.requestId === 'string' ? j.requestId
    : typeof details.requestId === 'string' ? details.requestId
    : typeof j.steps?.[0]?.requestId === 'string' ? j.steps[0].requestId
    : typeof j.steps?.[0]?.items?.[0]?.data?.orderId === 'string' ? j.steps[0].items[0].data.orderId
    : undefined;
  return {
    provider: 'relay',
    requestId: id,
    steps,
    feeUsd,
    etaSec,
    outAmount: /^\d+$/.test(outAmountRaw) ? fromSmallest(outAmountRaw, decimals) : String(out.amountFormatted ?? '0'),
    outAmountRaw,
    outDecimals: decimals,
    outToken: String(currency.symbol ?? input.destinationToken),
    minOut: /^\d+$/.test(minOutRaw) ? fromSmallest(minOutRaw, decimals) : fromSmallest(outAmountRaw, decimals),
    minOutRaw,
    originChainId: input.originChainId,
    originCurrency: input.originCurrency,
    originToken: input.originToken,
    inAmountRaw: input.amount,
    destinationChainId: input.destinationChainId,
    destinationSodexChain: input.destinationSodexChain,
    destinationToken: input.destinationToken,
    recipient: input.recipient,
    appFeeUsd,
    appFeeBps,
  };
}

export async function relayStatus(requestId: string, deps: RelayDeps): Promise<NormalizedStatus | null> {
  const url = `${RELAY_API}/intents/status/v3?requestId=${encodeURIComponent(requestId)}`;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (deps.apiKey) headers['x-api-key'] = deps.apiKey;
  const r = await deps.fetch(url, { headers, signal: timeoutSignal(deps.timeoutMs ?? 10_000) });
  if (!r.ok) return null;
  let json: any;
  try { json = await r.json(); } catch { return null; }
  const raw = String(json?.status ?? json?.data?.status ?? '').toLowerCase();
  const allowed = ['waiting', 'depositing', 'pending', 'success', 'failure', 'refund'] as const;
  const status = allowed.includes(raw as any) ? raw as typeof allowed[number] : raw === 'refunded' ? 'refund' : raw === 'failed' ? 'failure' : 'pending';
  return {
    provider: 'relay',
    status,
    txHash: json?.txHash ?? json?.inTxHashes?.[0] ?? json?.originTxHash,
    destTxHash: json?.destinationTxHash ?? json?.outTxHashes?.[0],
  };
}

function toHexValue(v: unknown): string {
  if (v == null || v === '' || v === '0' || v === '0x' || v === '0x0') return '0x0';
  if (typeof v === 'number' && Number.isFinite(v)) return '0x' + Math.trunc(v).toString(16);
  const s = String(v);
  if (s.startsWith('0x') || s.startsWith('0X')) return s;
  if (/^\d+$/.test(s)) return '0x' + BigInt(s).toString(16);
  return '0x0';
}

function pickUsd(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function pickNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
