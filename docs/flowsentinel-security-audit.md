# FlowSentinel security audit

- **Date:** 2026-11-04 (Asia/Calcutta)
- **Branch:** `builder-race-v2` (Cyptoboy777/soso-smre)
- **Scope:** Wave 3 Builder Race app; non-custodial SoDEX Builder Codes path; public APIs; client wallet flow
- **Out of scope actions this run:** Production env, merges, mainnet enablement, creating API keys
- **Verdict:** **PASS** (after fixes below). Remaining issues are accepted residual risks with no safe upstream fix or are intentionally deferred.

## Method

1. `npm audit` (prod + full) and dependency upgrades where safe
2. Secrets scan: `gitleaks detect` (git history) + `rg` patterns (values redacted; never printed)
3. Manual review of every `app/api/**/route.ts`, `next.config.ts` security headers, wallet/EIP-712 path, XSS surfaces, referral params
4. Fix high/medium issues on `builder-race-v2`, re-run tests / `tsc` / build, push, confirm Preview Ready + HTTP 200

## Verdict rationale

- No secrets found in git history (gitleaks: 0 leaks)
- No `dangerouslySetInnerHTML` usage
- Builder relay is not an open relay: confirm required, builder id/fee match, notional/size re-checked server-side, body size capped, mainnet relay gated
- Server never signs mainnet with held user keys; custodial signing path is testnet-only in `lib/sodex.ts`
- Critical Next.js advisories addressed by upgrading to 16.4.5
- Critical vitest/tinypool addressed by upgrading to vitest 5.1.0 (devDependency)
- Residual high: `sharp` via `kokoro-js` nested transformers (no fix available) — accepted for client TTS path

## Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| S1 | Critical | Next.js 16.2.6 multiple CVEs (middleware/proxy, SSRF, DoS, RCE classes) | **Fixed** — upgraded to `next@16.4.5` |
| S2 | Critical | `tinypool` / `vitest` RCE gadgets (dev tooling) | **Fixed** — upgraded to `vitest@5.1.0` (+ `vite` peer) |
| S3 | High | `postcss` XSS / sourcemap disclosure advisories | **Fixed** — resolved via `npm audit fix` with Next upgrade |
| S4 | High | `protobufjs` DoS / shadowing advisories | **Fixed** — resolved to patched 7.6.x via audit fix |
| S5 | High | Relay `/api/builder/relay-order` trusted client params for size (notional cap only on prepare) | **Fixed** — `assertRelayOrderParams` re-validates single-order batch, notional/funds vs `SODEX_MAX_NOTIONAL_USDC`, builder id+fee match; body size limit 32KB |
| S6 | High | `sharp` / libvips via `kokoro-js` → nested `@huggingface/transformers` | **Accepted** — no fix available upstream; client-side TTS only; not used for auth/trading |
| S7 | Medium | Missing HSTS header | **Fixed** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` |
| S8 | Medium | Missing rate limits on builder GET routes (`account`, `config`, `fee-stats`, `metrics`) | **Fixed** — IP rate limits added |
| S9 | Medium | `/api/builder/account` could return raw exception strings | **Fixed** — `publicErrorMessage` + server log only |
| S10 | Medium | Referral `idea` query param only length-sliced, not charset-sanitised | **Fixed** — `normalizeIdeaId` allowlist `[a-zA-Z0-9_-]{1,64}` |
| S11 | Medium | `/api/builder/metrics` exposed dry-run note / network internals | **Fixed** — slim public metrics (counts only) |
| S12 | Low | Demo page mentioned env var names | **Fixed** — user-facing copy softened |
| S13 | Low | Info disclosure via `/api/diag` key presence booleans | **Accepted** — already rate-limited; booleans only; useful for Wave 3 judges; no secret values |
| S14 | Info | `.env.local` present on builder box | **Accepted** — gitignored; not tracked; gitleaks clean |
| S15 | Info | No CORS wildcards; same-origin fetch for app APIs | **PASS** |
| S16 | Info | No `dangerouslySetInnerHTML`; news titles rendered as React text | **PASS** |
| S17 | Info | EIP-712: ApproveBuilderFee uses universal domain + network chain id; orders use spot domain; user wallet signs; relay does not hold user keys | **PASS** |
| S18 | Info | Mainnet trading remains off (`tradingLive: false`); no Production changes | **PASS** |

## API route review (summary)

| Route | Auth model | Caps / confirm | Rate limit | Notes |
| --- | --- | --- | --- | --- |
| `POST /api/builder/prepare-order` | User later signs | confirm or dryRun; `clampNotional`; allowlisted symbol | yes | Body size limited |
| `POST /api/builder/relay-order` | User signature relayed | confirm; builder match; **server notional/fee re-check**; mainnet kill switch | yes | Not open relay |
| `POST /api/builder/prepare-approval` | User later signs | builder id from server env | yes | Body size limited |
| `POST /api/builder/relay-approval` | User signature relayed | builder id must match; mainnet gated | yes | Body size limited |
| `GET /api/builder/account` | public address lookup | address format check; mainnet gated | yes | Errors sanitised |
| `GET /api/builder/config` | public | no secrets/notes | yes | practice/live mode only |
| `GET /api/builder/fee-stats` | public read of SoDEX | empty state if unset | yes | No invented numbers |
| `GET /api/builder/metrics` | public | counts only | yes | No wallet list |
| `POST /api/trade` | optional server testnet key | confirm; testnet hard-lock in `lib/sodex.ts` | yes | Not mainnet |

## Security headers

Present in `next.config.ts`: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP/CORP, `poweredByHeader: false`, `productionBrowserSourceMaps: false`, production `removeConsole` (keep error).

## Secrets scan

- **gitleaks** on git history: **no leaks found** (64 commits scanned)
- **rg** patterns: hits only empty placeholders in `.env.example`, comments in scripts/tests (`GEMINI_API_KEY = ''`), no live secret material printed or committed
- Tracked env templates: `.env.example` only; `.env.local` gitignored

## Dependency snapshot (post-fix)

- `next`: 16.4.5
- `vitest`: 5.1.0 (dev)
- Prod `npm audit --omit=dev`: **3 high** remaining, all `sharp` via `kokoro-js` (no fix)
- Full audit after upgrades: no critical remaining

## Verification

- `npx vitest run`: **51 passed** (10 files)
- `npx tsc --noEmit`: pass
- `npm run build`: pass (verified in this session)
- Push: `builder-race-v2` only
- Preview: confirm Ready + `/`, `/start`, `/stats`, `/judge`, `/api/builder/config` → 200; config still `builderId: 2674`, `tradingLive: false`

## Commits (security audit follow-up)

- `d5ceba0` security: audit fixes for builder-race-v2
- Prior race work: `9a3ac0e`, `fdff14e`

## Explicit non-actions

- Did **not** touch Production env or Production deployment
- Did **not** merge PRs
- Did **not** set `SODEX_MAINNET_TRADING`
- Did **not** create API keys or print secret values
