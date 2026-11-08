/**
 * Minimal browser wallet helpers (viem + window.ethereum).
 * Free/OSS only — no custodial key storage on the server.
 */
"use client";

import {
  createWalletClient,
  custom,
  type Hex,
  type WalletClient,
} from "viem";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export async function readWalletChainId(): Promise<number | null> {
  if (!window.ethereum) return null;
  const hex = await window.ethereum.request({ method: "eth_chainId" });
  if (typeof hex !== "string") return null;
  const id = Number.parseInt(hex, 16);
  return Number.isSafeInteger(id) ? id : null;
}

export async function connectInjectedWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error("No browser wallet detected. Install a free self-custody wallet extension.");
  }
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  const addr = accounts[0]?.toLowerCase();
  if (!addr || !/^0x[0-9a-f]{40}$/.test(addr)) {
    throw new Error("Wallet did not return an address");
  }
  return addr;
}

export function walletClientFor(address: string): WalletClient {
  if (!window.ethereum) throw new Error("No wallet");
  return createWalletClient({
    account: address as Hex,
    transport: custom(window.ethereum),
  });
}

function coerceMessage(
  message: Record<string, unknown>,
  types: Record<string, Array<{ name: string; type: string }>>,
  primaryType: string,
): Record<string, unknown> {
  const fields = types[primaryType] ?? [];
  const out: Record<string, unknown> = { ...message };
  for (const f of fields) {
    const v = out[f.name];
    if (v == null) continue;
    if (f.type.startsWith("uint") || f.type.startsWith("int")) {
      if (typeof v === "bigint") continue;
      out[f.name] = BigInt(typeof v === "number" ? Math.trunc(v) : String(v));
    }
  }
  return out;
}

export async function signTypedData(
  address: string,
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  },
): Promise<Hex> {
  const client = walletClientFor(address);
  const { EIP712Domain: _d, ...types } = typedData.types as Record<
    string,
    Array<{ name: string; type: string }>
  > & { EIP712Domain?: unknown };
  void _d;
  const message = coerceMessage(typedData.message, types, typedData.primaryType);
  return client.signTypedData({
    account: address as Hex,
    domain: typedData.domain as {
      name?: string;
      version?: string;
      chainId?: number | bigint;
      verifyingContract?: Hex;
    },
    types,
    primaryType: typedData.primaryType,
    message,
  });
}
