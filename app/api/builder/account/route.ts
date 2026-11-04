import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import {
  fetchPrimaryAccountId,
  fetchUserBuilders,
} from "@/lib/sodex-wallet-trade";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: "Valid address required" }, { status: 400 });
  }
  const cfg = getBuilderConfig();
  const networkParam = url.searchParams.get("network");
  const network: SodexNetworkLabel =
    networkParam === "mainnet" || networkParam === "testnet"
      ? networkParam
      : cfg.network;

  if (network === "mainnet" && (!cfg.builderId || !cfg.mainnetTradingEnabled)) {
    return NextResponse.json(
      {
        error:
          "Live trading is not available right now.",
        network,
      },
      { status: 403 },
    );
  }

  try {
    const accountId = await fetchPrimaryAccountId(network, address);
    const builders = accountId
      ? await fetchUserBuilders(network, address)
      : null;
    return NextResponse.json({
      network,
      address,
      accountId,
      builders,
      ourBuilderId: cfg.builderId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
