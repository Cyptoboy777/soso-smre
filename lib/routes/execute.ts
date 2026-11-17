import type { RouteStep } from './types';
import { NATIVE_ADDRESS } from './tokens';

export const REJECTED_MSG = 'You rejected the signature. Nothing was sent.';
export const UNKNOWN_SIG_MSG = 'This route needs a signature step this wallet cannot complete automatically. Nothing was sent. Try another amount or token.';

export function isUserRejected(e: unknown): boolean {
  const any = e as any;
  if (any?.code === 4001 || any?.code === 'ACTION_REJECTED') return true;
  const msg = String(any?.message ?? any ?? '');
  return /user rejected|user denied|rejected the request|denied transaction/i.test(msg);
}

export function friendlyExecError(e: unknown): string {
  if (isUserRejected(e)) return REJECTED_MSG;
  return 'The wallet could not complete that step. Nothing further was sent.';
}

export function txParams(step: RouteStep): Record<string, string> | null {
  const tx = step.tx;
  if (step.kind !== 'transaction' || !tx) return null;
  const p: Record<string, string> = { to: tx.to, value: tx.value ?? '0x0', data: tx.data ?? '0x' };
  if (tx.from) p.from = tx.from;
  if (tx.gas) p.gas = tx.gas.startsWith('0x') ? tx.gas : '0x' + BigInt(tx.gas).toString(16);
  return p;
}

const ERC20_APPROVE_PREFIX = '0x095ea7b3';

/** Minimal ERC-20 approve calldata (spender, max uint256). */
export function approveCalldata(spender: string): string {
  const addr = spender.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const max = 'f'.repeat(64);
  return ERC20_APPROVE_PREFIX + addr + max;
}

export function allowanceCalldata(owner: string, spender: string): string {
  return '0xdd62ed3e' + owner.toLowerCase().replace(/^0x/, '').padStart(64, '0') + spender.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

export function nextPollMs(attempt: number): number {
  if (attempt <= 1) return 2500;
  if (attempt === 2) return 3000;
  if (attempt === 3) return 5000;
  return 10_000;
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'waiting': return 'Waiting for the network to see the transaction.';
    case 'depositing': return 'The route is depositing your funds.';
    case 'pending': return 'The route is still in progress.';
    case 'success': return 'The funds have arrived in your wallet.';
    case 'failure': return 'The route did not complete. Check your wallet. Nothing else will be sent automatically.';
    case 'refund': return 'Refunded to your wallet.';
    default: return 'Checking the route…';
  }
}

export function needsApproval(originCurrency: string): boolean {
  return !!originCurrency && originCurrency.toLowerCase() !== NATIVE_ADDRESS.toLowerCase();
}

export function approvalStep(token: string, spender: string, chainId: number, owner: string): RouteStep {
  return {
    kind: 'transaction',
    chainId,
    action: 'Approve the token',
    description: 'Your wallet will ask you to allow the route contract to move this token. This is a standard approval. Nothing else is sent in this step.',
    tx: { from: owner, to: token, data: approveCalldata(spender), value: '0x0', chainId },
  };
}

