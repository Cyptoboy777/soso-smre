/**
 * Map internal errors to friendly user-facing copy.
 * Log the real detail server-side; never return env names, gateways, or stack traces.
 */

const FRIENDLY =
  "Something went wrong. Please try again in a moment.";
const FRIENDLY_CONFIRM =
  "Please confirm the details before continuing.";
const FRIENDLY_MAINNET =
  "Live trading is not available right now. You can keep practicing on the practice network.";
const FRIENDLY_WALLET =
  "We could not verify your wallet or account. Check your connection and try again.";
const FRIENDLY_RATE =
  "Too many requests. Please wait a minute and try again.";
const FRIENDLY_NETWORK =
  "The trading network did not accept that request. Please try again.";

export function logServerError(scope: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  // Server logs only — never sent to clients.
  console.error(`[${scope}]`, msg);
}

export function publicErrorMessage(err: unknown, fallback = FRIENDLY): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  if (!raw) return fallback;
  if (lower.includes("rate limit")) return FRIENDLY_RATE;
  if (lower.includes("confirm")) return FRIENDLY_CONFIRM;
  if (
    lower.includes("mainnet") ||
    lower.includes("kill switch") ||
    lower.includes("sodex_mainnet") ||
    lower.includes("sodex_builder")
  ) {
    return FRIENDLY_MAINNET;
  }
  if (
    lower.includes("wallet") ||
    lower.includes("address") ||
    lower.includes("account") ||
    lower.includes("signature") ||
    lower.includes("sign")
  ) {
    return FRIENDLY_WALLET;
  }
  if (
    lower.includes("sodex http") ||
    lower.includes("sodex code") ||
    lower.includes("gateway") ||
    lower.includes("fetch")
  ) {
    return FRIENDLY_NETWORK;
  }
  // Never echo raw internal strings that look like env/config/debug.
  if (
    /SODEX_|kill switch|dry-?run|mainnet-gw|testnet-gw|stack|at\s+\S+\s+\(/i.test(
      raw,
    )
  ) {
    return fallback;
  }
  // Short, already-friendly messages (no env noise) may pass through.
  if (raw.length <= 120 && !/[`]/.test(raw) && !raw.includes("process.env")) {
    return raw;
  }
  return fallback;
}

export function jsonPublicError(
  scope: string,
  err: unknown,
  status = 400,
  fallback = FRIENDLY,
): { body: { error: string }; status: number } {
  logServerError(scope, err);
  return {
    body: { error: publicErrorMessage(err, fallback) },
    status,
  };
}
