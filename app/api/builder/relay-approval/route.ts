import { logServerError, publicErrorMessage } from "@/lib/public-errors";
import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { relayBuilderApproval } from "@/lib/sodex-wallet-trade";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-approve-relay:${ip}`,
    20,
    60 * 60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  if (!cfg.builderId) {
    return NextResponse.json(
      { error: "App fee approval is not available right now." },
      { status: 400 },
    );
  }

  const body = (await req.json()) as {
    userAddress?: string;
    network?: SodexNetworkLabel;
    apiChain?: number;
    nonce?: string;
    signature?: string;
    accountID?: number;
    builderID?: number;
    maxFeeRate?: number;
  };

  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) {
    return NextResponse.json({ error: "Connect a valid wallet to continue." }, { status: 400 });
  }
  if (!body.signature || !body.nonce || body.apiChain == null) {
    return NextResponse.json(
      { error: "Something is missing from the approval request. Please try again." },
      { status: 400 },
    );
  }
  if (body.builderID !== cfg.builderId) {
    return NextResponse.json(
      { error: "This approval could not be verified. Please try again." },
      { status: 400 },
    );
  }

  const network = body.network === "mainnet" ? "mainnet" : "testnet";
  if (network === "mainnet" && !cfg.mainnetTradingEnabled) {
    return NextResponse.json(
      { error: "Live trading is not available right now. You can keep practicing on the practice network." },
      { status: 403 },
    );
  }

  const result = await relayBuilderApproval({
    userAddress,
    network,
    apiChain: Number(body.apiChain),
    nonce: String(body.nonce),
    signature: body.signature,
    body: {
      accountID: Number(body.accountID),
      builderID: Number(body.builderID),
      maxFeeRate: Number(body.maxFeeRate),
    },
  });

  if (!result.ok) {
    logServerError("relay-approval", result.error);
    return NextResponse.json({ error: publicErrorMessage(result.error) }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
