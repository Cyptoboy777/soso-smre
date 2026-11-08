import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { readSpotBalances, readSpotOrders } from "@/lib/sodex-account-read";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rejectIfRateLimited(
    `builder-orders:${clientIp(req)}`,
    40,
    60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const url = new URL(req.url);
  const address = (url.searchParams.get("address") ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: "Connect a valid wallet to continue." }, { status: 400 });
  }
  const cfg = getBuilderConfig();
  const requested = url.searchParams.get("network");
  const network: SodexNetworkLabel =
    requested === "mainnet" && cfg.mainnetTradingEnabled ? "mainnet" : "testnet";
  const accountId = Number(url.searchParams.get("accountId") ?? "");
  const account = Number.isSafeInteger(accountId) && accountId > 0 ? accountId : undefined;

  const [orders, balances] = await Promise.all([
    readSpotOrders(network, address, account),
    readSpotBalances(network, address, account),
  ]);

  return NextResponse.json({
    networkLabel: network === "mainnet" ? "SoDEX mainnet" : "SoDEX practice network",
    fetchedAt: new Date().toISOString(),
    ordersAvailable: orders.available,
    open: orders.open,
    history: orders.history.slice(0, 20),
    balancesAvailable: balances.available,
    balances: balances.balances,
    note: orders.available
      ? "Open orders and recent history from your account. An empty list is not a failed order."
      : "Account orders could not be read. Nothing here was invented.",
  });
}
