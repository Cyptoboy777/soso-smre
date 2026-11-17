/**
 * SoDEX API-key registration helpers.
 *
 * Wallet-signed registration follows the official Go SDK's SignAddAPIKeyAction
 * when signatureChainID is set (sodex-tech/sodex-go-sdk-public/common/signer/evm_signer.go):
 *   primaryType  UserSignedAddAPIKeyAction
 *   domain       name "universal", version "1", chainId = wallet's current chain
 *   message      chainID = SoDEX chain (286623 / 138565), then nonce, accountID, name, keyType, publicKey, expiresAt
 *   headers      X-API-Sign = 0x02 || 65-byte ECDSA (v in {0,1}), X-API-Nonce, X-API-Chain = domain chainId
 *   body         { accountID, name, type: 1, publicKey, expiresAt }  — no signature fields
 *   endpoint     POST /api/v1/user/<address>/api-keys  (one call registers both engines)
 *
 * The plain AddAPIKey typed struct (no chainID in the message, domain chain = SoDEX) is the
 * local-private-key path. Live wallet submissions of that form are recovered incorrectly and
 * the spot engine answers "API key not found".
 */

export const MAX_API_KEYS = 10;
export const API_KEY_TYPE_EVM = 1;
export const SIG_TYPE_EIP712_UNIVERSAL = 0x02;
export const UNIVERSAL_DOMAIN_NAME = 'universal';
export const UNIVERSAL_DOMAIN_VERSION = '1';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const EIP712_DOMAIN_FIELDS = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
] as const;

/** Official type string from sodex-go-sdk-public/common/types/eip712.go */
export const USER_SIGNED_ADD_API_KEY_TYPE =
  'UserSignedAddAPIKeyAction(uint64 chainID,uint64 nonce,uint64 accountID,string name,uint8 keyType,bytes publicKey,uint64 expiresAt)';

export const USER_SIGNED_ADD_API_KEY_FIELDS = [
  { name: 'chainID', type: 'uint64' },
  { name: 'nonce', type: 'uint64' },
  { name: 'accountID', type: 'uint64' },
  { name: 'name', type: 'string' },
  { name: 'keyType', type: 'uint8' },
  { name: 'publicKey', type: 'bytes' },
  { name: 'expiresAt', type: 'uint64' },
] as const;

export const ADD_API_KEY_TYPE =
  'AddAPIKey(uint64 accountID,string name,uint8 keyType,bytes publicKey,uint64 expiresAt,uint64 nonce)';

export type ApiKeyInfo = { name: string; expiresAt?: number; publicKey?: string; type?: string | number };
export type ApiKeyList = { spot?: ApiKeyInfo[]; perps?: ApiKeyInfo[] };

export function keySlots(keys: ApiKeyList | null | undefined, max: number = MAX_API_KEYS) {
  const used = Math.max(keys?.spot?.length ?? 0, keys?.perps?.length ?? 0);
  return { used, free: Math.max(0, max - used), full: used >= max };
}

export function keyListed(keys: ApiKeyList | null | undefined, name: string): boolean {
  return !!(keys?.spot?.some((k) => k.name === name) || keys?.perps?.some((k) => k.name === name));
}

export function universalDomain(signatureChainId: number) {
  return {
    name: UNIVERSAL_DOMAIN_NAME,
    version: UNIVERSAL_DOMAIN_VERSION,
    chainId: signatureChainId,
    verifyingContract: ZERO_ADDRESS,
  };
}

export function buildUserSignedAddApiKey(input: {
  sodexChainId: number;
  signatureChainId: number;
  accountID: number;
  name: string;
  publicKey: string;
  expiresAt: number;
  nonce: number;
}) {
  const publicKey = normalizePublicKey(input.publicKey);
  const message = {
    chainID: String(input.sodexChainId),
    nonce: String(input.nonce),
    accountID: String(input.accountID),
    name: input.name,
    keyType: API_KEY_TYPE_EVM,
    publicKey,
    expiresAt: String(input.expiresAt),
  };
  const typedData = {
    types: {
      EIP712Domain: EIP712_DOMAIN_FIELDS.map((f) => ({ ...f })),
      UserSignedAddAPIKeyAction: USER_SIGNED_ADD_API_KEY_FIELDS.map((f) => ({ ...f })),
    },
    primaryType: 'UserSignedAddAPIKeyAction' as const,
    domain: universalDomain(input.signatureChainId),
    message,
  };
  const body = {
    accountID: input.accountID,
    name: input.name,
    type: API_KEY_TYPE_EVM,
    publicKey,
    expiresAt: input.expiresAt,
  };
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-API-Chain': String(input.signatureChainId),
    'X-API-Nonce': String(input.nonce),
  };
  return { typedData, body, headers, nonce: input.nonce };
}

export function normalizePublicKey(key: string): string {
  const s = key.startsWith('0x') ? key : '0x' + key;
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) throw new Error('Trading key address is invalid.');
  return s.toLowerCase();
}

export function wrapUniversalSignature(rawSig: string): string {
  const s = rawSig.startsWith('0x') ? rawSig.slice(2) : rawSig;
  if (s.length !== 130 || /[^0-9a-fA-F]/.test(s)) throw new Error('Unexpected signature from wallet.');
  const bytes = new Uint8Array(65);
  for (let i = 0; i < 65; i++) bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  if (bytes[64] >= 27) bytes[64] -= 27;
  if (bytes[64] > 3) throw new Error('Unexpected signature from wallet.');
  let out = '';
  for (let i = 0; i < 65; i++) out += bytes[i].toString(16).padStart(2, '0');
  return '0x' + SIG_TYPE_EIP712_UNIVERSAL.toString(16).padStart(2, '0') + out;
}

export function errorCode(e: any): number | string | undefined {
  return e?.code ?? e?.error?.code ?? e?.data?.originalError?.code ?? e?.info?.error?.code;
}

export function errorMessage(e: any): string {
  return String(e?.message ?? e?.error?.message ?? e?.data?.originalError?.message ?? e ?? '');
}

/** True only when the user clicked Reject, not when the wallet auto-closed over a chain mismatch. */
export function isUserRejected(e: any): boolean {
  const code = errorCode(e);
  const rejected = code === 4001 || code === '4001' || code === 'ACTION_REJECTED';
  if (!rejected) return false;
  return !/chain|network|mismatch/i.test(errorMessage(e));
}

export function isUnrecognizedChain(e: any): boolean {
  const code = errorCode(e);
  const msg = errorMessage(e);
  if (code === 4902 || code === '4902') return true;
  return /unrecognized chain|unknown chain|not added|no matching/i.test(msg);
}

export function walletActionError(e: any, kind: 'sign' | 'switch' = 'sign'): string {
  if (isUserRejected(e)) {
    return kind === 'switch'
      ? 'The network switch was rejected in the wallet.'
      : 'Signature was rejected in the wallet.';
  }
  if (/chain|network|mismatch/i.test(errorMessage(e)) || isUnrecognizedChain(e)) {
    return 'The wallet could not use the network this signature needs. Add ValueChain (chain 286623) if asked, then try again.';
  }
  return 'The wallet could not complete the signature. Please try again.';
}

export function isKeyGoneText(s: string): boolean {
  return /api key/i.test(s) && /not found|invalid|expired|revoked|disabled/i.test(s);
}

export function isKeyGone(e: unknown): boolean {
  const raw = String((e as any)?.raw ?? '');
  const msg = String((e as any)?.message ?? '');
  return isKeyGoneText(raw) || isKeyGoneText(msg) || /trading session has ended/i.test(msg);
}

const ALREADY_FRIENDLY = /please try again|tap enable trading|sodex account already has 10|not enough balance|could not reach sodex|sodex is (slow|busy)|too many requests|trading session/i;

export function looksLikeRawSodex(s: string): boolean {
  return /^(spot|perps|futures|bolt|spark)\s*:/i.test(s) || /api key error/i.test(s) || /error:\s*/i.test(s);
}

export function friendlySodexError(raw: string): string {
  const s = String(raw ?? '');
  if (!s) return 'SoDEX could not complete this request. Please try again.';
  if (ALREADY_FRIENDLY.test(s) && !looksLikeRawSodex(s)) return s;
  if (isKeyGoneText(s)) {
    return 'Your trading session has ended. Tap Enable trading to start a new one, then try again.';
  }
  if (/maximum number of api keys|too many api keys|reached maximum/i.test(s) || (/api keys/i.test(s) && /maximum|limit|cap/i.test(s))) {
    return 'This SoDEX account already has 10 API keys. Remove an unused one at sodex.com/apikeys, then try again.';
  }
  if (/nonce/i.test(s) && /invalid|expire|used|old|window/i.test(s)) {
    return 'The request expired or was already used. Please try again.';
  }
  if (/signature|sign/i.test(s) && /invalid|fail|mismatch|reject|recover/i.test(s)) {
    return 'The wallet signature was not accepted. Please try Enable trading again.';
  }
  if (/insufficient|not enough|balance|margin/i.test(s)) {
    return 'Not enough balance on SoDEX for this order.';
  }
  if (/permission|not allowed|forbidden/i.test(s)) {
    return 'This trading key does not have permission for that action.';
  }
  if (/rate limit|too many request/i.test(s)) {
    return 'Too many requests. Please wait a few seconds and try again.';
  }
  return 'SoDEX could not complete this request. Please try again.';
}

export function userFacingError(e: any, fallback = 'Something went wrong. Please try again.'): string {
  if (isUserRejected(e)) return 'Signature was rejected in the wallet.';
  const msg = String(e?.message ?? '');
  if (msg && !looksLikeRawSodex(msg)) return msg;
  if (msg) return friendlySodexError(e?.raw ?? msg);
  return fallback;
}

export const REGISTER_KEY_FAILED =
  'SoDEX could not register the trading key. Please try again. If this keeps happening, remove an unused key at sodex.com/apikeys first.';

export const KEYS_AT_CAP =
  'This SoDEX account already has 10 API keys. Remove an unused one at sodex.com/apikeys, then try again.';
