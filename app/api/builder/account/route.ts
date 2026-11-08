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
  const network: SodexNetworkLabel = "mainnet";

  try {
    const accountId = await fetchPrimaryAccountId(network, address);
    const builders = accountId
      ? await fetchUserBuilders(network, address)
      : null;
    return NextResponse.json({
      targetNetwork: "mainnet",
      chainId: 286623,
      executionEnabled: cfg.executionEnabled,
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
