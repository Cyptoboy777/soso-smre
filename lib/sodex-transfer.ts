/**
 * Official SoDEX Perps → Spot transfer helpers.
 *
 * Sources (do not invent fields):
 * - TransferAssetRequest field order: sodex-go-sdk-public/common/types/transfer_asset_request.go
 * - type SPOT_WITHDRAW = 5, toAccountID 999:
 *   docs.sodex.com schema TransferAssetTypeEnum + Perps "Transfer asset to spot"
 * - Signing: ActionPayload{type, params} → keccak256 → ExchangeAction on the "futures" domain
 *   (perps/signer SignTransferAssetRequest → SignAction). No UserSigned transfer form exists.
 * - Amount is a positive DecimalString, floored so places do not exceed coin.precision.
 * - Safe max is per-coin state field `at` ("available wallet balance for transfer / withdrawal"),
 *   not account-level `amw` ("available margin for transfer").
 */

export const TRANSFER_ASSET_ACTION = 'transferAsset';
export const SPOT_WITHDRAW = 5;
export const SPOT_WITHDRAW_TO_ACCOUNT_ID = 999;
export const FUTURES_DOMAIN = 'futures';

export type TransferAssetParams = {
  id: number;
  fromAccountID: number;
  toAccountID: number;
  coinID: number;
  amount: string;
  type: number;
};

export type MoveValidation =
  | { ok: true; amount: string }
  | { ok: false; message: string };

const SAFE_UINT64_MAX = Number.MAX_SAFE_INTEGER;

export function isSafeUint64(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= SAFE_UINT64_MAX;
}

/** Canonical decimal string matching shopspring/decimal JSON: no sign, no exponent, no trailing zeros, integers have no point. */
export function canonicalDecimal(input: string): string | null {
  const raw = String(input ?? '').trim().replace(',', '.');
  if (!raw || raw === '.' || raw === '+' || raw === '-') return null;
  if (/[eE+]/.test(raw) || raw.startsWith('-')) return null;
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(raw)) return null;
  const [intRaw, fracRaw = ''] = raw.split('.');
  const int = (intRaw.replace(/^0+/, '') || '0');
  const frac = fracRaw.replace(/0+$/, '');
  if (!/^\d+$/.test(int)) return null;
  return frac ? `${int}.${frac}` : int;
}

export function compareDecimal(a: string, b: string): number | null {
  const ca = canonicalDecimal(a);
  const cb = canonicalDecimal(b);
  if (ca == null || cb == null) return null;
  const [ai, af = ''] = ca.split('.');
  const [bi, bf = ''] = cb.split('.');
  if (ai.length !== bi.length) return ai.length < bi.length ? -1 : 1;
  if (ai !== bi) return ai < bi ? -1 : 1;
  const len = Math.max(af.length, bf.length);
  const as = af.padEnd(len, '0');
  const bs = bf.padEnd(len, '0');
  if (as === bs) return 0;
  return as < bs ? -1 : 1;
}

export function floorToPrecision(amount: string, precision: number): string | null {
  if (!Number.isInteger(precision) || precision < 0 || precision > 36) return null;
  const c = canonicalDecimal(amount);
  if (c == null) return null;
  const [int, frac = ''] = c.split('.');
  if (frac.length <= precision) return c;
  const cut = frac.slice(0, precision).replace(/0+$/, '');
  return cut ? `${int}.${cut}` : int;
}

export function validateMoveToSpot(opts: {
  amount: string;
  available: string;
  precision: number;
}): MoveValidation {
  const available = floorToPrecision(opts.available, opts.precision);
  if (available == null) {
    return { ok: false, message: 'SoDEX did not report a usable amount for this coin. Try again, or move it on sodex.com.' };
  }
  const cmpZero = compareDecimal(available, '0');
  if (cmpZero == null || cmpZero <= 0) {
    return { ok: false, message: 'SoDEX is holding this as margin. There is no amount available to move right now.' };
  }
  const entered = canonicalDecimal(opts.amount);
  if (entered == null) {
    return { ok: false, message: 'Enter a valid amount.' };
  }
  const floored = floorToPrecision(entered, opts.precision);
  if (floored == null) {
    return { ok: false, message: 'Enter a valid amount.' };
  }
  const positive = compareDecimal(floored, '0');
  if (positive == null || positive <= 0) {
    return { ok: false, message: 'Enter an amount greater than zero.' };
  }
  const vsMax = compareDecimal(floored, available);
  if (vsMax == null) {
    return { ok: false, message: 'Enter a valid amount.' };
  }
  if (vsMax > 0) {
    return { ok: false, message: `The most you can move is ${available}. That is the amount SoDEX has available for transfer, not the total balance.` };
  }
  return { ok: true, amount: floored };
}

export function buildTransferAssetParams(input: {
  id: number;
  fromAccountID: number;
  toAccountID?: number;
  coinID: number;
  amount: string;
  type?: number;
}): TransferAssetParams {
  const amount = canonicalDecimal(input.amount);
  if (amount == null) throw new Error('Enter a valid amount.');
  if (!isSafeUint64(input.id) || input.id === 0) throw new Error('A fresh transfer id is required.');
  if (!isSafeUint64(input.fromAccountID) || input.fromAccountID === 0) {
    throw new Error('No SoDEX Margin & Futures account was found for this wallet.');
  }
  if (!isSafeUint64(input.coinID) || input.coinID === 0) throw new Error('This coin is missing its SoDEX id.');
  const toAccountID = input.toAccountID ?? SPOT_WITHDRAW_TO_ACCOUNT_ID;
  const type = input.type ?? SPOT_WITHDRAW;
  if (toAccountID !== SPOT_WITHDRAW_TO_ACCOUNT_ID || type !== SPOT_WITHDRAW) {
    throw new Error('Only a move from Margin & Futures to Spot is supported.');
  }
  // Field insertion order matches the official Go struct / signed JSON.
  return {
    id: input.id,
    fromAccountID: input.fromAccountID,
    toAccountID,
    coinID: input.coinID,
    amount,
    type,
  };
}

/** Compact JSON in official ActionPayload and TransferAssetRequest field order. */
export function transferAssetPayloadJson(params: TransferAssetParams): string {
  const body = transferAssetBodyJson(params);
  return `{"type":"${TRANSFER_ASSET_ACTION}","params":${body}}`;
}

export function transferAssetBodyJson(params: TransferAssetParams): string {
  return `{"id":${params.id},"fromAccountID":${params.fromAccountID},"toAccountID":${params.toAccountID},"coinID":${params.coinID},"amount":${JSON.stringify(params.amount)},"type":${params.type}}`;
}

export function transferAssetTypedData(opts: {
  chainId: number;
  payloadHash: string;
  nonce: number;
}) {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ExchangeAction: [
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint64' },
      ],
    },
    primaryType: 'ExchangeAction' as const,
    domain: {
      name: FUTURES_DOMAIN,
      version: '1',
      chainId: opts.chainId,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    },
    message: {
      payloadHash: opts.payloadHash,
      nonce: String(opts.nonce),
    },
  };
}

export function friendlyTransferError(raw: string): string {
  const s = String(raw ?? '');
  if (/margin/i.test(s) || /insufficient|not enough|available|balance/i.test(s)) {
    return 'SoDEX kept this amount as margin. Try a smaller amount.';
  }
  if (/nonce/i.test(s) && /invalid|expire|used|old|window/i.test(s)) {
    return 'The request expired or was already used. Please try again.';
  }
  if (/signature|sign/i.test(s) && /invalid|fail|mismatch|reject|recover/i.test(s)) {
    return 'The wallet signature was not accepted. Please try again.';
  }
  if (/permission|not allowed|forbidden/i.test(s)) {
    return 'SoDEX did not allow this transfer with the current signature.';
  }
  if (/rate limit|too many request/i.test(s)) {
    return 'Too many requests. Please wait a few seconds and try again.';
  }
  return 'SoDEX could not complete this transfer. Please try again.';
}
