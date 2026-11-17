import { ROUTE_LS_KEY, type NormalizedQuote, type RouteStatusValue } from './types';

export type SavedRoute = {
  v: 1;
  provider: 'relay' | 'lifi';
  requestId?: string;
  txHash?: string;
  originChainId: number;
  destinationChainId: number;
  destinationSodexChain: string;
  destinationToken: string;
  recipient: string;
  outAmount: string;
  minOut: string;
  startedAt: number;
  status: RouteStatusValue;
};

export function savedFromQuote(q: NormalizedQuote, extra?: Partial<SavedRoute>): SavedRoute {
  return {
    v: 1,
    provider: q.provider,
    requestId: q.requestId,
    originChainId: q.originChainId,
    destinationChainId: q.destinationChainId,
    destinationSodexChain: q.destinationSodexChain,
    destinationToken: q.destinationToken,
    recipient: q.recipient,
    outAmount: q.outAmount,
    minOut: q.minOut,
    startedAt: Date.now(),
    status: 'waiting',
    ...extra,
  };
}

export function loadSavedRoute(): SavedRoute | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ROUTE_LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || p.v !== 1) return null;
    return p as SavedRoute;
  } catch {
    return null;
  }
}

export function storeSavedRoute(row: SavedRoute | null) {
  if (typeof localStorage === 'undefined') return;
  if (!row) localStorage.removeItem(ROUTE_LS_KEY);
  else localStorage.setItem(ROUTE_LS_KEY, JSON.stringify(row));
}
