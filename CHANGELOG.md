# Changelog

## 2026-10-30 (honesty fix)

- Track record: never resolve unfilled SoDEX orders (`NEW`/`RESTING`) against the mark (fixes false +1471% on limit @ 5000 vs ~78k).
- Scrub absurd PnL (>50%) and re-open false resolutions on read.
- Seed copy clarifies resting limit is unfilled proof, not a filled position.
- User-facing copy: removed em dashes (hero, desk, judge, voice, API notes).

All notable Wave 3 work for FlowSentinel lives on branch `flowsentinel-wave3` (preview only — do not merge to `main` until after judging).

## Wave 3 — FlowSentinel (2026-10-30)

Rebuild as a single insight-to-action AI fund desk for the AKINDO SoSoValue buildathon Wave 3.

### Live SoDEX testnet proof (EIP-712)

- Account `60539` on `testnet-gw.sodex.dev` (chainId `138565`)
- Order **1301914828** — MARKET IOC (partial fill) via `/api/trade`
- Order **1301909841** — FILLED (MARKET IOC buy; trade `9461764`, 0.00005 vBTC @ 78619)
- Order **1301909840** — NEW (LIMIT buy 0.001 @ 5000, resting)
- Server max notional **10 USDC**; mainnet hard-locked out
- Diag flags `sodexTrade=true` / `TESTNET_LIVE_EIP712` when credentials present
- Cancel path frees margin; per-order batch errors rejected honestly

### SoSoValue inside the decision

- Live `/etfs/summary-history` (BTC+ETH), `/news/hot`, `/indices/ssimag7/market-snapshot`
- JARVIS ranks ideas with news citations, confidence, risk note, invalidation
- Gemini thesis when keyed; deterministic rules fallback otherwise
- API diagnostics page probes each endpoint (status + latency)

### Risk, honesty, judge path

- Hard risk gate (`lib/risk-engine.ts`) with pass/fail reasons + confirm checkbox
- Desk pills: **TESTNET LIVE** vs **DRY-RUN SIMULATED** (no paper ambiguity)
- `/judge` 60-second path: Data → thesis → risk → confirm → receipt
- Track record seeded with real order IDs; empty states when APIs fail
- Voice co-pilot narrates the same ticket and never places orders

### Brand and UX

- Sentinel Eye logo, dark + SoSoValue orange (`#FF4F20`) theme
- Hero proof strip with EIP-712 order IDs
- Continuous VAD voice mode (Kokoro English TTS; Piper for other languages)
- SEO, security headers, soft API rate limit, terms/privacy

### Removed (prior sprawl called out by judges)

- Podcast studio / animated dual hosts, Telegram alpha, alpha leaderboard
- Social “Proof of PnL” holographic cards with invented live ROI
- Wallet-gated main path for the demo loop

### Integration endpoints

- SoSoValue: `GET /etfs/summary-history`, `GET /news/hot`, `GET /indices/{ticker}/market-snapshot`
- SoDEX testnet: public tickers; authenticated EIP-712 `batchNewOrder` / cancel when `SODEX_*` set

## Earlier waves

Prior production site remains on the default branch / prior deploy for Waves 1–2 history. Wave 3 preview: https://flowsentinel-app.vercel.app
