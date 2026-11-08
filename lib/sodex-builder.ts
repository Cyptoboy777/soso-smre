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
  /** Kill switch: order submission off unless explicitly released. */
  mainnetTradingEnabled: boolean;
  /** Release gate for submitting signatures. Independent of the review network. */
  executionEnabled: boolean;
  /** Order payloads and public reads use this network. */
  targetNetwork: "mainnet";
  network: SodexNetworkLabel;
  maxNotionalUsdc: number;
  /** True when Builder ID is set and we may tag orders. */
  builderReady: boolean;
  /** Human fee strings (internal/tests). */
  feeLabel: string;
  maxApprovalLabel: string;
  /** Plain percent strings for user copy. */
  appFeePercent: string;
  maxApprovalPercent: string;
  /** Server-only; keep empty for public payloads. */
  notes: string[];
  /** Mainnet constants for UI / dry-run readiness (never implies submits are live). */
  mainnet: {
    chainId: number;
    gateway: string;
    readyWhenEnabled: boolean;
  };
  /** Shown whenever the selected network is mainnet or a mainnet dry-run is prepared. */
  realFundsWarning: string;
  feeDisclosure: {
    perpsBothSides: string;
    spotBuyExempt: string;
    caps: string;
  };
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

/** Format tenths-of-bp as human percent / bp (internal / tests). */
export function formatTenthsOfBp(tenths: number): string {
  const bp = tenths / 10;
  const pct = tenths / 1000; // 10 tenths = 1 bp = 0.01%
  return `${bp} bp (${pct.toFixed(pct < 0.01 ? 3 : 2)}%)`;
}

/** Plain percent for user-facing app fee copy, e.g. 0.01%. */
export function formatAppFeePercent(tenths: number): string {
  const pct = tenths / 1000;
  const digits = pct < 0.01 ? 3 : pct < 0.1 ? 2 : 2;
  return `${pct.toFixed(digits)}%`;
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

  let network: SodexNetworkLabel = "mainnet";
  const executionEnabled = mainnetTradingEnabled;

  const readyWhenEnabled =
    builderId != null && maxApproval > 0 && builderFee > 0 && maxNotionalUsdc > 0;
  const appFeePercent = formatAppFeePercent(builderFee);
  const maxApprovalPercent = formatAppFeePercent(maxApproval);

  return {
    builderId,
    builderFee,
    maxApproval,
    mainnetTradingEnabled,
    /** Customer reads and order payloads always target mainnet. */
    targetNetwork: "mainnet" as const,
    /** Release gate. False means payloads can be reviewed and must not be submitted. */
    executionEnabled,
    network,
    maxNotionalUsdc,
    builderReady: builderId != null,
    feeLabel: formatTenthsOfBp(builderFee),
    maxApprovalLabel: formatTenthsOfBp(maxApproval),
    appFeePercent,
    maxApprovalPercent,
    /** Server-only diagnostics — never send this array to public clients. */
    notes: [],
    mainnet: {
      chainId: SODEX_NETWORK.mainnet.chainId,
      gateway: SODEX_NETWORK.mainnet.gateway,
      readyWhenEnabled,
    },
    realFundsWarning:
      "You are about to use real funds. FlowSentinel never holds your keys. Every order needs your wallet signature and an explicit confirm. Order size is capped.",
    feeDisclosure: {
      perpsBothSides:
        "On perps, the app fee can apply on both buy and sell fills.",
      spotBuyExempt:
        "On spot buys, no app fee applies. Spot sells may include the app fee.",
      caps: `Includes a ${appFeePercent} app fee (you approve up to ${maxApprovalPercent}).`,
    },
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
 * Payload preparation is allowed on mainnet while submission is released off.
 * Relay is a separate gate.
 */
export function assertTradingAllowed(opts: {
  network: SodexNetworkLabel;
  confirmed: boolean;
  /** Kept for older callers. Preparation no longer depends on it. */
  dryRun?: boolean;
}): string | null {
  if (!opts.confirmed && !opts.dryRun) return "Explicit user confirmation required";
  return null;
}

/** Submission gate. Off until release, for every network. No testnet bypass. */
export function assertRelayAllowed(opts: {
  network: SodexNetworkLabel;
  confirmed: boolean;
}): string | null {
  if (!opts.confirmed) return "Explicit user confirmation required";
  if (!getBuilderConfig().executionEnabled) {
    return "Order submission is not enabled.";
  }
  void opts.network;
  return null;
}

export function clampNotional(
  notional: number,
  cap = getBuilderConfig().maxNotionalUsdc,
): number {
  if (!Number.isFinite(notional) || notional <= 0) return 0;
  return Math.min(notional, cap);
}
