/**
 * Register a SoDEX *testnet* API-key wallet.
 *
 * RUN ON YOUR OWN PC ONLY. Do not run on a cloud agent / shared box.
 * Never paste your master private key into chat, Discord, or a remote shell.
 *
 * What it does:
 *  1. Generates a fresh API-key EVM wallet locally (OS CSPRNG via viem).
 *  2. Asks you for the master wallet private key via a hidden prompt (once).
 *  3. EIP-712-signs AddAPIKey under domain { name:"universal", chainId:138565 }.
 *  4. POSTs to testnet-gw only (hard-locked; mainnet refused).
 *  5. Writes SODEX_* lines to a local secret file (mode 0600). Never prints secrets.
 *
 * Usage (on your PC):
 *   npm i viem tsx
 *   export SODEX_ACCOUNT_ID=<aid from GET /api/v1/spot/accounts/<master>/state>
 *   export SODEX_MASTER_ADDRESS=0x...   # master wallet address (public)
 *   # Optional: SODEX_API_KEY_NAME=flowsentinel-test-01  SODEX_KEY_DAYS=30
 *   npx tsx scripts/register-testnet-api-key.ts
 *
 * Docs:
 *   https://sodex.com/documentation/for-developers/developers/trading/authentication-and-signing
 *   https://sodex.com/documentation/for-developers/developers/trading/api-keys-and-nonces
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output, stderr } from "node:process";
import { writeFileSync, chmodSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { concatHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const TESTNET_CHAIN_ID = 138565;
const TESTNET_BASE = "https://testnet-gw.sodex.dev";
const ZERO = "0x0000000000000000000000000000000000000000" as const;

function die(msg: string): never {
  stderr.write(`\nERROR: ${msg}\n`);
  process.exit(1);
}

async function hiddenPrompt(label: string): Promise<string> {
  // Best-effort hidden input (tty). Falls back to visible readline if needed.
  if (!input.isTTY || !output.isTTY) {
    die("Refusing to read master key from a non-TTY. Run on your own terminal.");
  }
  output.write(label);
  return await new Promise((resolvePromise, reject) => {
    const wasRaw = input.isRaw;
    const chunks: Buffer[] = [];
    const onData = (buf: Buffer) => {
      const s = buf.toString("utf8");
      if (s === "\n" || s === "\r" || s === "\r\n") {
        input.setRawMode?.(wasRaw ?? false);
        input.pause();
        input.removeListener("data", onData);
        output.write("\n");
        resolvePromise(Buffer.concat(chunks).toString("utf8").trim());
        return;
      }
      if (s === "\u0003") {
        input.setRawMode?.(wasRaw ?? false);
        reject(new Error("cancelled"));
        return;
      }
      if (s === "\u007f" || s === "\b") {
        chunks.pop();
        return;
      }
      chunks.push(Buffer.from(s));
      output.write("*");
    };
    input.setRawMode?.(true);
    input.resume();
    input.on("data", onData);
  });
}

function normalizeRecovery(sig: Hex): Hex {
  // Viem uses 27/28 recovery; SoDEX AddAPIKey wire format wants 0/1.
  const recovery = Number.parseInt(sig.slice(-2), 16);
  const wire =
    sig.slice(0, -2) +
    (recovery >= 27 ? recovery - 27 : recovery).toString(16).padStart(2, "0");
  return wire as Hex;
}

async function main() {
  const accountIdRaw = process.env.SODEX_ACCOUNT_ID?.trim();
  const masterAddress = process.env.SODEX_MASTER_ADDRESS?.trim();
  if (!accountIdRaw || !masterAddress) {
    die(
      "Set SODEX_ACCOUNT_ID and SODEX_MASTER_ADDRESS (master wallet public address) first.",
    );
  }
  const accountID = Number(accountIdRaw);
  if (!Number.isSafeInteger(accountID) || accountID <= 0) {
    die("SODEX_ACCOUNT_ID must be a safe positive integer (data.aid from account state).");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(masterAddress)) {
    die("SODEX_MASTER_ADDRESS must be a 0x-prefixed 20-byte address.");
  }

  // Hard-lock testnet
  if (process.env.SODEX_NETWORK && /mainnet/i.test(process.env.SODEX_NETWORK)) {
    die("This script is hard-locked to SoDEX testnet (chainId 138565). Refusing mainnet.");
  }

  const name =
    process.env.SODEX_API_KEY_NAME?.trim() ||
    `fs-test-${Date.now().toString(36).slice(-6)}`;
  if (!/^[0-9a-zA-Z_-]{1,36}$/.test(name) || name === "default") {
    die("SODEX_API_KEY_NAME must match ^[0-9a-zA-Z_-]{1,36}$ and not be 'default'.");
  }

  const days = Math.min(
    90,
    Math.max(1, Number(process.env.SODEX_KEY_DAYS ?? "30") || 30),
  );

  const outPath = resolve(
    process.env.SODEX_SECRET_OUT?.trim() || "./sodex_testnet_api_key.secret.txt",
  );
  if (existsSync(outPath)) {
    die(`Refusing to overwrite existing ${outPath}. Move or delete it first.`);
  }

  stderr.write(
    [
      "",
      "SoDEX TESTNET API-key registration",
      "----------------------------------",
      `  network:     testnet only (chainId ${TESTNET_CHAIN_ID})`,
      `  gateway:     ${TESTNET_BASE}`,
      `  accountID:   ${accountID}`,
      `  master:      ${masterAddress}`,
      `  key name:    ${name}`,
      `  expires:     ${days} day(s)`,
      `  secret out:  ${outPath}`,
      "",
      "This will generate a NEW API-key wallet locally and ask the MASTER wallet",
      "to sign AddAPIKey. The master private key is used once and discarded.",
      "Nothing is printed that contains a private key.",
      "",
      "Type REGISTER to continue: ",
    ].join("\n"),
  );

  const rl = createInterface({ input, output: stderr });
  const confirm = (await rl.question("")).trim();
  rl.close();
  if (confirm !== "REGISTER") die("Aborted (did not type REGISTER).");

  const apiKeyPrivateKey = generatePrivateKey();
  const apiKeyAccount = privateKeyToAccount(apiKeyPrivateKey);

  if (apiKeyAccount.address.toLowerCase() === masterAddress.toLowerCase()) {
    die("Generated API-key wallet matched master address — refusing.");
  }

  const masterPkRaw = await hiddenPrompt(
    "Paste MASTER wallet private key (hidden, never printed): ",
  );
  const masterPk = (
    masterPkRaw.startsWith("0x") ? masterPkRaw : `0x${masterPkRaw}`
  ) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(masterPk)) {
    die("Master private key must be 32-byte hex.");
  }
  const master = privateKeyToAccount(masterPk);
  if (master.address.toLowerCase() !== masterAddress.toLowerCase()) {
    die(
      `Master key address ${master.address} does not match SODEX_MASTER_ADDRESS ${masterAddress}.`,
    );
  }

  const nonce = BigInt(Date.now());
  const expiresAt = Number(nonce) + days * 24 * 60 * 60 * 1000;

  const signature = await master.signTypedData({
    domain: {
      name: "universal",
      version: "1",
      chainId: TESTNET_CHAIN_ID,
      verifyingContract: ZERO,
    },
    types: {
      AddAPIKey: [
        { name: "accountID", type: "uint64" },
        { name: "name", type: "string" },
        { name: "keyType", type: "uint8" },
        { name: "publicKey", type: "bytes" },
        { name: "expiresAt", type: "uint64" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "AddAPIKey",
    message: {
      accountID: BigInt(accountID),
      name,
      keyType: 1,
      publicKey: apiKeyAccount.address,
      expiresAt: BigInt(expiresAt),
      nonce,
    },
  });

  const wireSignature = normalizeRecovery(signature);
  const apiSign = concatHex(["0x02", wireSignature]);

  const res = await fetch(
    `${TESTNET_BASE}/api/v1/user/${master.address}/api-keys`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Chain": String(TESTNET_CHAIN_ID),
        "X-API-Nonce": nonce.toString(),
        "X-API-Sign": apiSign,
      },
      body: JSON.stringify({
        accountID,
        name,
        type: 1,
        publicKey: apiKeyAccount.address,
        expiresAt,
      }),
    },
  );
  const text = await res.text();
  let parsed: { code?: number; error?: string; msg?: string } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    /* keep */
  }
  if (!res.ok || (typeof parsed.code === "number" && parsed.code !== 0)) {
    die(
      `Registration failed: HTTP ${res.status} ${parsed.error ?? parsed.msg ?? text.slice(0, 200)}`,
    );
  }

  const lines = [
    `# SoDEX TESTNET API key — generated ${new Date().toISOString()}`,
    `# NEVER commit this file. chmod 600. Delete after copying into .env.`,
    `SODEX_ACCOUNT_ID=${accountID}`,
    `SODEX_API_KEY_NAME=${name}`,
    `SODEX_API_KEY_PRIVATE_KEY=${apiKeyPrivateKey}`,
    `# public (safe to log): apiKeyAddress=${apiKeyAccount.address} expiresAt=${expiresAt}`,
    "",
  ].join("\n");

  writeFileSync(outPath, lines, { mode: 0o600 });
  chmodSync(outPath, 0o600);

  stderr.write(
    [
      "",
      "Registration accepted by testnet gateway.",
      `Secret written to: ${outPath} (mode 0600)`,
      `API key name:      ${name}`,
      `API key address:   ${apiKeyAccount.address}`,
      `Expires (ms):      ${expiresAt}`,
      "",
      "Next:",
      "  1. Confirm: GET /api/v1/user/<master>/api-keys?accountID=…&name=…",
      "  2. Copy the three SODEX_* lines into your local .env (never commit).",
      "  3. Delete this secret file.",
      "  4. FlowSentinel stays testnet-only — no mainnet path.",
      "",
      "Private keys were NEVER printed.",
      "",
    ].join("\n"),
  );
}

main().catch((e) => {
  die(e instanceof Error ? e.message : String(e));
});
