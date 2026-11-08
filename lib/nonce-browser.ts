/**
 * Browser nonce reservation. Web Locks serialize tabs in one browser profile.
 * localStorage survives a reload. It does not coordinate two devices.
 */
import { allocateNonce, type NonceNetwork } from "@/lib/nonce-policy";

function storage(): Storage {
  if (typeof localStorage === "undefined") {
    throw new Error("This browser cannot store a signing nonce.");
  }
  return localStorage;
}

function deviceOffset(network: NonceNetwork, address: string): number {
  const key = `fs-nonce-offset:${network}:${address.toLowerCase()}`;
  const existing = storage().getItem(key);
  const parsed = existing ? Number(existing) : NaN;
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 499) return parsed;
  const bytes = new Uint16Array(1);
  crypto.getRandomValues(bytes);
  const offset = (bytes[0] % 499) + 1;
  storage().setItem(key, String(offset));
  return offset;
}

export async function reserveSigningNonce(
  network: NonceNetwork,
  signingAddress: string,
  lane: "trade" | "account" = "trade",
): Promise<string> {
  const run = () =>
    allocateNonce({
      store: {
        get: (key) => storage().getItem(`fs-nonce:${key}`),
        set: (key, value) => storage().setItem(`fs-nonce:${key}`, value),
      },
      network,
      signingAddress,
      nowMs: Date.now(),
      deviceOffset: deviceOffset(network, signingAddress),
      lane,
    });
  const lock = `fs-nonce:${lane}:${network}:${signingAddress.toLowerCase()}`;
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(lock, run);
  }
  return run();
}
