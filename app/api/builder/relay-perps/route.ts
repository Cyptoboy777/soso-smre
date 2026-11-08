import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { relayUserAction } from "@/lib/sodex-wallet-trade";
import { readJsonBodyLimited } from "@/lib/builder-order-guard";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { logServerError, publicErrorMessage } from "@/lib/public-errors";
import { parseBatchReceipt } from "@/lib/order-receipt";

export const dynamic = "force-dynamic";

const ROUTES: Record<string, { method: "POST" | "DELETE"; path: string }> = {
  newOrder: { method: "POST", path: "/trade/orders" },
  cancelOrder: { method: "DELETE", path: "/trade/orders" },
  replaceOrder: { method: "POST", path: "/trade/orders/replace" },
  modifyOrder: { method: "POST", path: "/trade/orders/modify" },
  newTwapOrder: { method: "POST", path: "/trade/twaps" },
  cancelTwapOrder: { method: "DELETE", path: "/trade/twaps" },
  newDcaOrder: { method: "POST", path: "/trade/dcas" },
  cancelDcaOrder: { method: "DELETE", path: "/trade/dcas" },
};

export async function POST(req: Request) {
  const limited = rejectIfRateLimited(`builder-perps-relay:${clientIp(req)}`, 12, 60 * 60_000, "Too many requests. Please wait a minute and try again.");
  if (limited) return limited;
  const parsed = await readJsonBodyLimited(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 413 });
  const body = parsed.value as {
    confirmed?: boolean;
    userAddress?: string;
    network?: SodexNetworkLabel;
    market?: "spot" | "perps";
    signType?: string;
    params?: Record<string, unknown>;
    nonce?: string;
    signature?: string;
  };
  if (!body.confirmed) return NextResponse.json({ error: "Please confirm the details before continuing." }, { status: 400 });
  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) return NextResponse.json({ error: "Connect a valid wallet to continue." }, { status: 400 });
  const route = ROUTES[body.signType ?? ""];
  if (!route || !body.params || !body.nonce || !body.signature) {
    return NextResponse.json({ error: "Something is missing from the order request. Please try again." }, { status: 400 });
  }
  const network: SodexNetworkLabel = body.network === "mainnet" ? "mainnet" : "testnet";
  const cfg = getBuilderConfig();
  if (network === "mainnet" && !cfg.mainnetTradingEnabled) {
    logServerError("relay-perps", "mainnet relay refused");
    return NextResponse.json({ error: "Live trading is not available right now. You can keep using the practice network." }, { status: 403 });
  }
  const market = body.market === "spot" ? "spot" : "perps";
  if (market === "spot" && (body.signType === "newOrder" || body.signType === "cancelOrder" || body.signType === "replaceOrder" || body.signType === "modifyOrder")) {
    return NextResponse.json({ error: "That action is not available on spot from this path." }, { status: 400 });
  }
  const result = await relayUserAction({ network, market, method: route.method, path: route.path, params: body.params, nonce: body.nonce, signature: body.signature });
  if (!result.ok && !result.venueRejected) {
    logServerError("relay-perps", result.error);
    return NextResponse.json({ error: publicErrorMessage(result.error) }, { status: 502 });
  }
  const receipt = parseBatchReceipt(result.raw);
  return NextResponse.json({ ok: receipt.stage === "accepted" || receipt.stage === "partial", receipt, retryAllowed: false });
}
