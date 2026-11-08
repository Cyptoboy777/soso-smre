/**
 * SoDEX nonce policy.
 * The venue stores the 100 highest nonces per signing address and accepts a new
 * nonce only inside (blockTime - 2 days, blockTime + 1 day), never reused.
 * https://docs.sodex.com/for-developers/developers/trading/api-keys-and-nonces.md
 *
 * There is no shared database in this app. The signer’s browser is the nonce
 * authority (localStorage + Web Locks). The server only checks the window and
 * rejects a nonce it has already seen in this process. Two devices can still
 * pick the same value; the venue then rejects the duplicate. That is not a
 * second fill. A restarted or second serverless instance cannot see the other
 * instance’s set.
 */

export const NONCE_PAST_MS = 2 * 24 * 60 * 60 * 1000;
export const NONCE_FUTURE_MS = 24 * 60 * 60 * 1000;

export type NonceNetwork = "mainnet" | "testnet";

export function nonceScope(
  network: NonceNetwork,
  signingAddress: string,
  lane: "trade" | "account" = "trade",
): string {
  const address = signingAddress.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    throw new Error("Connect a valid wallet to continue.");
  }
  if (network !== "mainnet" && network !== "testnet") {
    throw new Error("Choose a network before preparing an order.");
  }
  return `${lane}:${network}:${address}`;
}

export function nonceInWindow(nonce: bigint, nowMs: number): boolean {
  const now = BigInt(nowMs);
  return nonce > now - BigInt(NONCE_PAST_MS) && nonce < now + BigInt(NONCE_FUTURE_MS);
}

export type NonceStore = {
  get(key: string): string | null;
  set(key: string, value: string): void;
};

/**
 * Reserve the next nonce for one signer on one network.
 * `deviceOffset` is a stable per-browser integer from 1 to 499 so two devices
 * that both start from the same millisecond do not have to share it.
 * The sequence is monotonic for this store and is not scoped by account id:
 * SoDEX tracks the signing address, and one wallet can use several accounts.
 */
export function allocateNonce(input: {
  store: NonceStore;
  network: NonceNetwork;
  signingAddress: string;
  nowMs: number;
  deviceOffset: number;
  lane?: "trade" | "account";
}): string {
  if (!Number.isInteger(input.deviceOffset) || input.deviceOffset < 1 || input.deviceOffset > 499) {
    throw new Error("The nonce offset for this browser is invalid.");
  }
  const scope = nonceScope(input.network, input.signingAddress, input.lane ?? "trade");
  const now = BigInt(input.nowMs);
  const lastRaw = input.store.get(scope);
  const last = lastRaw && /^[0-9]+$/.test(lastRaw) ? BigInt(lastRaw) : BigInt(0);
  let next = last + BigInt(1) > now ? last + BigInt(1) : now;
  if (next === now) next = now + BigInt(input.deviceOffset);
  if (next <= last) next = last + BigInt(1);
  if (!nonceInWindow(next, input.nowMs)) {
    throw new Error("The signing clock is outside the venue nonce window. Reconcile before preparing another order.");
  }
  input.store.set(scope, next.toString());
  return next.toString();
}

const seen = new Map<string, bigint>();

export function resetSeenNoncesForTests(): void {
  seen.clear();
}

/** Best-effort replay check for this server process only. */
export function claimPreparedNonce(input: {
  network: NonceNetwork;
  signingAddress: string;
  nonce: string;
  nowMs?: number;
}): { ok: true } | { ok: false; error: string } {
  if (!/^[0-9]+$/.test(input.nonce)) {
    return { ok: false, error: "The signing nonce is not valid." };
  }
  const value = BigInt(input.nonce);
  const now = input.nowMs ?? Date.now();
  if (!nonceInWindow(value, now)) {
    return { ok: false, error: "The signing nonce is outside the venue time window. Reserve a new one and review the order again." };
  }
  const key = `${nonceScope(input.network, input.signingAddress)}:${input.nonce}`;
  if (seen.has(key)) {
    return { ok: false, error: "That signing nonce was already used in this session. Review the order again." };
  }
  seen.set(key, value);
  return { ok: true };
}
