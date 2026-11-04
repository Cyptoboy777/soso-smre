import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import {
  fetchPrimaryAccountId,
  fetchUserBuilders,
} from "@/lib/sodex-wallet-trade";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { logServerError, publicErrorMessage } from "@/lib/public-errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-account:${ip}`,
    60,
    60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const url = new URL(req.url);
  const address = (url.searchParams.get("address") ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Connect a valid wallet to continue." },
      { status: 400 },
    );
  }
  const cfg = getBuilderConfig();
  const networkParam = url.searchParams.get("network");
  const network: SodexNetworkLabel =
    networkParam === "mainnet" || networkParam === "testnet"
      ? networkParam
      : cfg.network;

  if (network === "mainnet" && (!cfg.builderId || !cfg.mainnetTradingEnabled)) {
    return NextResponse.json(
      { error: "Live trading is not available right now." },
      { status: 403 },
    );
  }

  try {
    const accountId = await fetchPrimaryAccountId(network, address);
    const builders = accountId
      ? await fetchUserBuilders(network, address)
      : null;
    return NextResponse.json({
      mode: network === "mainnet" && cfg.mainnetTradingEnabled ? "live" : "practice",
      address,
      accountId,
      builders,
      ourBuilderId: cfg.builderId,
    });
  } catch (e) {
    logServerError("builder-account", e);
    return NextResponse.json(
      { error: publicErrorMessage(e) },
      { status: 502 },
    );
  }
}
