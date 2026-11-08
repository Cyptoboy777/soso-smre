/**
 * Per-signing-address nonce reservation for one server process.
 * SoDEX stores the 100 highest nonces per signer and requires a fresh nonce
 * inside (blockTime - 2 days, blockTime + 1 day).
 * Docs: https://docs.sodex.com/for-developers/developers/trading/api-keys-and-nonces.md
 *
 * This does not coordinate across instances. A second server can still collide.
 */

const lastNonce = new Map<string, bigint>();

export function reserveNonce(signingAddress: string, nowMs = Date.now()): string {
  const key = signingAddress.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(key)) {
    throw new Error("Connect a valid wallet to continue.");
  }
  const now = BigInt(nowMs);
  const prev = lastNonce.get(key) ?? BigInt(0);
  const next = now > prev ? now : prev + BigInt(1);
  lastNonce.set(key, next);
  return next.toString();
}

export function resetNonceLedgerForTests(): void {
  lastNonce.clear();
}
