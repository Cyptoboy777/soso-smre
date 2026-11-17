import { fromSmallest } from './amount';
import type { NormalizedQuote, NormalizedStatus, QuoteInput, RouteStep } from './types';

export const LIFI_API = 'https://li.quest/v1';

export type LifiDeps = { fetch: typeof fetch; timeoutMs?: number; integrator?: string; feeFraction?: number };

function timeoutSignal(ms: number) {
  return AbortSignal.timeout(ms);
}

export async function lifiQuote(input: QuoteInput, deps: LifiDeps): Promise<NormalizedQuote | null> {
  const q = new URL(`${LIFI_API}/quote`);
  q.searchParams.set('fromChain', String(input.originChainId));
  q.searchParams.set('toChain', String(input.destinationChainId));
  q.searchParams.set('fromToken', input.originCurrency);
  q.searchParams.set('toToken', input.destinationCurrency);
  q.searchParams.set('fromAmount', input.amount);
  q.searchParams.set('fromAddress', input.user);
  q.searchParams.set('toAddress', input.recipient);
  if (deps.integrator) q.searchParams.set('integrator', deps.integrator.slice(0, 23));
  if (deps.feeFraction && deps.feeFraction > 0 && deps.feeFraction < 1) q.searchParams.set('fee', String(deps.feeFraction));
  const r = await deps.fetch(q.toString(), { headers: { accept: 'application/json' }, signal: timeoutSignal(deps.timeoutMs ?? 10_000) });
  if (!r.ok) return null;
  let json: unknown;
  try { json = await r.json(); } catch { return null; }
  return normalizeLifiQuote(json, input, deps.feeFraction ? Math.round(deps.feeFraction * 10_000) : 0);
}

export function normalizeLifiQuote(json: unknown, input: QuoteInput, appFeeBps = 0): NormalizedQuote | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as any;
  const tr = j.transactionRequest;
  if (!tr || typeof tr.to !== 'string') return null;
  const chainId = Number(tr.chainId ?? input.originChainId);
  const steps: RouteStep[] = [{
    kind: 'transaction',
    chainId,
    action: 'Send the route transaction',
    description: 'Your wallet will ask you to confirm this transaction. Nothing is sent until you approve.',
    tx: {
      from: typeof tr.from === 'string' ? tr.from : input.user,
      to: tr.to,
      data: typeof tr.data === 'string' ? tr.data : '0x',
      value: toHexValue(tr.value),
      chainId,
      gas: tr.gasLimit ? String(tr.gasLimit) : undefined,
      gasPrice: tr.gasPrice ? String(tr.gasPrice) : undefined,
    },
  }];
  const estimate = j.estimate ?? {};
  const toToken = j.action?.toToken ?? estimate.toToken ?? {};
  const decimals = Number(toToken.decimals ?? 6) || 6;
  const outAmountRaw = String(estimate.toAmount ?? '0');
  const minOutRaw = String(estimate.toAmountMin ?? estimate.toAmount ?? '0');
  const feeCosts = Array.isArray(estimate.feeCosts) ? estimate.feeCosts : [];
  const gasCosts = Array.isArray(estimate.gasCosts) ? estimate.gasCosts : [];
  const feeUsd = sumUsd(feeCosts) + sumUsd(gasCosts);
  const etaSec = pickNum(estimate.executionDuration);
  const requestId = typeof j.id === 'string' ? j.id : undefined;
  return {
    provider: 'lifi',
    requestId,
    steps,
    feeUsd: Number.isFinite(feeUsd) && feeUsd > 0 ? feeUsd : (feeUsd === 0 ? 0 : null),
    etaSec,
    outAmount: fromSmallest(/^\d+$/.test(outAmountRaw) ? outAmountRaw : '0', decimals),
    outAmountRaw: /^\d+$/.test(outAmountRaw) ? outAmountRaw : '0',
    outDecimals: decimals,
    outToken: String(toToken.symbol ?? input.destinationToken),
    minOut: fromSmallest(/^\d+$/.test(minOutRaw) ? minOutRaw : '0', decimals),
    minOutRaw: /^\d+$/.test(minOutRaw) ? minOutRaw : '0',
    originChainId: input.originChainId,
    originCurrency: input.originCurrency,
    originToken: input.originToken,
    inAmountRaw: input.amount,
    destinationChainId: input.destinationChainId,
    destinationSodexChain: input.destinationSodexChain,
    destinationToken: input.destinationToken,
    recipient: input.recipient,
    appFeeUsd: null,
    appFeeBps,
  };
}

export async function lifiStatus(txHash: string, deps: LifiDeps, chains?: { fromChain?: number; toChain?: number }): Promise<NormalizedStatus | null> {
  const q = new URL(`${LIFI_API}/status`);
  q.searchParams.set('txHash', txHash);
  if (chains?.fromChain) q.searchParams.set('fromChain', String(chains.fromChain));
  if (chains?.toChain) q.searchParams.set('toChain', String(chains.toChain));
  const r = await deps.fetch(q.toString(), { headers: { accept: 'application/json' }, signal: timeoutSignal(deps.timeoutMs ?? 10_000) });
  if (!r.ok) return null;
  let json: any;
  try { json = await r.json(); } catch { return null; }
  const st = String(json?.status ?? '').toUpperCase();
  const sub = String(json?.substatus ?? '').toUpperCase();
  let status: NormalizedStatus['status'] = 'pending';
  if (st === 'NOT_FOUND') status = 'waiting';
  else if (st === 'PENDING') status = 'pending';
  else if (st === 'FAILED' || st === 'INVALID') status = 'failure';
  else if (st === 'DONE') {
    if (sub === 'REFUNDED' || sub === 'REFUND') status = 'refund';
    else status = 'success'; // COMPLETED, PARTIAL treated as success of the transfer; UI still says estimate
  }
  return {
    provider: 'lifi',
    status,
    txHash: json?.sending?.txHash ?? txHash,
    destTxHash: json?.receiving?.txHash,
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
function sumUsd(arr: any[]): number {
  return arr.reduce((t, x) => t + (Number(x?.amountUSD ?? x?.amountUsd ?? 0) || 0), 0);
}
function pickNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
