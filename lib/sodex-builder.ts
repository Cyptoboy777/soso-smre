/**
 * SoDEX Builder Codes helpers (docs-backed only).
 * Guide: https://docs.sodex.com/for-developers/developers/trading/builder-codes-in-trading.md
 *
 * Never hardcodes a Builder ID. Never holds user private keys.
 */

export const SODEX_NETWORK = {
  mainnet: {
    chainId: 286623,
    label: "mainnet" as const,
    gateway: "https://mainnet-gw.sodex.dev",
  },
  testnet: {
    chainId: 138565,
    label: "testnet" as const,
    gateway: "https://testnet-gw.sodex.dev",
  },
} as const;

export type SodexNetworkLabel = "mainnet" | "testnet";

/** Tenths of a basis point. Spot cap 2000 (2%), Perps cap 200 (0.2%). */
export const BUILDER_FEE_CAPS = {
  spot: 2000,
  perps: 200,
  approvalMax: 2000,
} as const;

const ZERO =
  "0x0000000000000000000000000000000000000000" as const;

export type BuilderParams = {
  id: number;
  fee: number;
};

export type BuilderConfig = {
  builderId: number | null;
  /** Requested fee on orders, tenths of a bp. */
  builderFee: number;
  /** Suggested maxFeeRate for ApproveBuilderFeeAction. */
  maxApproval: number;
  /** Kill switch: mainnet trading off unless explicitly enabled. */
  mainnetTradingEnabled: boolean;
  network: SodexNetworkLabel;
  maxNotionalUsdc: number;
  /** True when Builder ID is set and we may tag orders. */
  builderReady: boolean;
  /** Human fee strings for UI. */
  feeLabel: string;
  maxApprovalLabel: string;
  notes: string[];
};

function parsePositiveInt(raw: string | undefined): number | null {
  const t = raw?.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

function parseNonNegInt(raw: string | undefined, fallback: number): number {
  const t = raw?.trim();
  if (!t) return fallback;
  if (!/^\d+$/.test(t)) return fallback;
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n < 0) return fallback;
  return n;
}

function envFlagOn(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Format tenths-of-bp as human percent / bp. */
export function formatTenthsOfBp(tenths: number): string {
  const bp = tenths / 10;
  const pct = tenths / 10000;
  return `${bp} bp (${(pct * 100).toFixed(4)}%)`;
}

/**
 * Active builder + network gates.
 * Missing SODEX_BUILDER_ID → testnet / dry-run posture (no mainnet trading).
 */
export function getBuilderConfig(): BuilderConfig {
  const builderId = parsePositiveInt(process.env.SODEX_BUILDER_ID);
  const builderFeeRaw = parseNonNegInt(process.env.SODEX_BUILDER_FEE, 10);
  const maxApprovalRaw = parseNonNegInt(
    process.env.SODEX_BUILDER_MAX_APPROVAL,
    Math.max(builderFeeRaw, 10),
  );
  const builderFee = Math.min(builderFeeRaw, BUILDER_FEE_CAPS.spot);
  const maxApproval = Math.min(maxApprovalRaw, BUILDER_FEE_CAPS.approvalMax);
  const mainnetTradingEnabled = envFlagOn("SODEX_MAINNET_TRADING");
  const maxNotionalUsdc = Math.max(
    1,
    parseNonNegInt(process.env.SODEX_MAX_NOTIONAL_USDC, 10),
  );

  const notes: string[] = [];
  let network: SodexNetworkLabel = "testnet";

  if (!builderId) {
    notes.push(
      "SODEX_BUILDER_ID is not set. Orders stay on testnet / dry-run and are not tagged with a builder fee.",
    );
  } else if (!mainnetTradingEnabled) {
    notes.push(
      "SODEX_MAINNET_TRADING is off (kill switch). Mainnet submits are refused; testnet / dry-run only.",
    );
  } else {
    network = "mainnet";
    notes.push(
      "Mainnet trading kill switch is ON. Users must connect their own wallet, approve the builder fee, and confirm every order.",
    );
  }

  notes.push(
    "Spot builder fees do not apply to the buying side of spot trades (SoDEX docs). Perps apply on both sides.",
  );

  return {
    builderId,
    builderFee,
    maxApproval,
    mainnetTradingEnabled,
    network,
    maxNotionalUsdc,
    builderReady: builderId != null,
    feeLabel: formatTenthsOfBp(builderFee),
    maxApprovalLabel: formatTenthsOfBp(maxApproval),
    notes,
  };
}

export function gatewayFor(network: SodexNetworkLabel): string {
  return SODEX_NETWORK[network].gateway;
}

export function publicApiBase(network: SodexNetworkLabel): string {
  return `${gatewayFor(network)}/api/v1`;
}

export function spotApiBase(network: SodexNetworkLabel): string {
  return `${gatewayFor(network)}/api/v1/spot`;
}

export function networkChainId(network: SodexNetworkLabel): number {
  return SODEX_NETWORK[network].chainId;
}

/** Attach builder as last field after orders (spot batch field order). */
export function withBatchBuilder(
  params: Record<string, unknown>,
  builder: BuilderParams | null,
): Record<string, unknown> {
  if (!builder) {
    const { builder: _drop, ...rest } = params;
    void _drop;
    return rest;
  }
  return {
    ...params,
    builder: { id: builder.id, fee: builder.fee },
  };
}

export function builderParamsFromConfig(
  cfg: BuilderConfig = getBuilderConfig(),
): BuilderParams | null {
  if (!cfg.builderId) return null;
  return { id: cfg.builderId, fee: cfg.builderFee };
}

/** EIP-712 typed data for ApproveBuilderFeeAction (master wallet). */
export function buildApproveBuilderFeeTypedData(opts: {
  network: SodexNetworkLabel;
  /** Value sent as X-API-Chain and domain.chainId */
  apiChain: number;
  nonce: bigint;
  accountId: number;
  builderId: number;
  maxFeeRate: number;
}) {
  const messageChainId = networkChainId(opts.network);
  return {
    domain: {
      name: "universal" as const,
      version: "1" as const,
      chainId: opts.apiChain,
      verifyingContract: ZERO,
    },
    types: {
      ApproveBuilderFeeAction: [
        { name: "chainID", type: "uint64" },
        { name: "nonce", type: "uint64" },
        { name: "accountID", type: "uint64" },
        { name: "builderID", type: "uint64" },
        { name: "maxFeeRate", type: "uint64" },
      ],
    },
    primaryType: "ApproveBuilderFeeAction" as const,
    message: {
      chainID: messageChainId,
      nonce: opts.nonce,
      accountID: opts.accountId,
      builderID: opts.builderId,
      maxFeeRate: opts.maxFeeRate,
    },
  };
}

/** EIP-712 typed data for spot ExchangeAction (order signing). */
export function buildSpotExchangeTypedData(opts: {
  network: SodexNetworkLabel;
  payloadHash: `0x${string}`;
  nonce: bigint;
}) {
  return {
    domain: {
      name: "spot" as const,
      version: "1" as const,
      chainId: networkChainId(opts.network),
      verifyingContract: ZERO,
    },
    types: {
      ExchangeAction: [
        { name: "payloadHash", type: "bytes32" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "ExchangeAction" as const,
    message: {
      payloadHash: opts.payloadHash,
      nonce: opts.nonce,
    },
  };
}

/**
 * Mainnet submit gate. Returns error string if blocked.
 * Never allows mainnet when Builder ID missing or kill switch off.
 */
export function assertTradingAllowed(opts: {
  network: SodexNetworkLabel;
  confirmed: boolean;
}): string | null {
  if (!opts.confirmed) return "Explicit user confirmation required";
  const cfg = getBuilderConfig();
  if (opts.network === "mainnet") {
    if (!cfg.builderId) {
      return "Mainnet trading blocked: SODEX_BUILDER_ID is not set";
    }
    if (!cfg.mainnetTradingEnabled) {
      return "Mainnet trading blocked: SODEX_MAINNET_TRADING kill switch is off";
    }
  }
  return null;
}

export function clampNotional(
  notional: number,
  cap = getBuilderConfig().maxNotionalUsdc,
): number {
  if (!Number.isFinite(notional) || notional <= 0) return 0;
  return Math.min(notional, cap);
}
