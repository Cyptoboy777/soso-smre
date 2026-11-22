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

/** ERC-20 approve calldata limited to the exact quoted input amount. */
export function approveCalldata(spender: string, amount: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(spender)) throw new Error('Invalid approval spender.');
  if (!/^\d+$/.test(amount)) throw new Error('Invalid approval amount.');
  const value = BigInt(amount);
  if (value <= 0n || value >= 1n << 256n) throw new Error('Invalid approval amount.');
  const addr = spender.toLowerCase().slice(2).padStart(64, '0');
  return ERC20_APPROVE_PREFIX + addr + value.toString(16).padStart(64, '0');
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

export function approvalStep(token: string, spender: string, chainId: number, owner: string, amount: string): RouteStep {
  return {
    kind: 'transaction',
    chainId,
    action: 'Approve the quoted amount',
    description: 'Your wallet will allow the route contract to move only the exact amount in this quote. Nothing else is sent in this step.',
    tx: { from: owner, to: token, data: approveCalldata(spender, amount), value: '0x0', chainId },
  };
}

