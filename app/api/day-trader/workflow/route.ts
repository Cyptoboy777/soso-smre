import { NextResponse } from "next/server";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rejectIfRateLimited(
    `day-trader:${clientIp(req)}`,
    20,
    60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;
  return NextResponse.json({ error: "That simulation is not offered." }, { status: 410 });
}
