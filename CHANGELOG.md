# Changelog

## 2026-10-30 — SoDEX testnet live

- Real EIP-712 testnet orders: 1301909841 FILLED, 1301909840 NEW (account 60539).
- Diag `sodexTrade=true` / `TESTNET_LIVE_EIP712` when credentials present.
- Server max notional 10 USDC; risk gate + confirm still required.
- Track record seeded with live order IDs; `/judge` 60s path; JARVIS + Gemini.


## Unreleased — public launch polish

- Grok-style fullscreen voice mode with react-three-fiber orb (idle/listening/thinking/speaking), mic + TTS AnalyserNode levels, Bloom
- TTS: Kokoro-82M (kokoro-js) for English; Piper for Hindi/es/fr/pt/it; Web Speech fallback
- STT: Whisper tiny via transformers.js when loaded; Web Speech fallback
- Telugu removed from language chips; added French, Portuguese, Italian
- Lazy 3D hero capital-flow field (r3f) after idle; Lenis smooth scroll; reduced-motion static fallback
- SEO: metadata, OG, manifest, robots, sitemap; terms/privacy; 404/error/loading; skip link; security headers; API soft rate limit
- Branch preview: https://flowsentinel-app.vercel.app

## Unreleased

- SoDEX client rewritten for EIP-712 spot signing (viem); hard-locked to testnet
- Env: `SODEX_ACCOUNT_ID` / `SODEX_API_KEY_NAME` / `SODEX_API_KEY_PRIVATE_KEY` (replaces HMAC pair)
- `scripts/register-testnet-api-key.ts` for local testnet key registration (do not run on shared hosts)
- SoSoValue fetch cache revalidate=300s (respect ~20/min rate limit)
- Desk clearly labels DRY-RUN when SoDEX keys absent

## Wave 3 (since Jul 4 submission)

Rebuild as **FlowSentinel** — cut feature sprawl and ship a single insight→action loop for the AKINDO SoSoValue buildathon Wave 3.

### Removed (judge feedback: sprawl)
- Podcast / SoEva host, SoDoggy assistant, Telegram alerts
- Leaderboard, achievements, backtest UI
- Wallet-gated main path (RainbowKit / wagmi no longer required to demo)
- Mock data presented as live when keys were missing

### Added
- Award-level hero (animated mark, flow-field, Data→Thesis→Risk→Order steps), ETF history charts (recharts), glass cards, track-record hit-rate ring + timeline, voice language chips
- Premium polish: animated FlowRadar, CountUp metrics, staggered panels, refined logo/favicon, empty/fallback states
- Multilingual **Voice desk** (Web Speech STT/TTS): thesis / risk / flows / news Q&A; never places orders by voice

- SoSoValue-first desk: BTC/ETH US ETF flows, hot news, ssiMAG7, SoDEX tickers
- Honest **Live / Fallback** badges on every data panel
- AI daily thesis (Gemini) with confidence + drivers; deterministic rules fallback
- Risk gate: sizing, max drawdown, geometry, confidence floor, news-shock pause — pass/fail reasons
- Explicit confirmation → SoDEX **testnet** limit order (dry-run when keys absent)
- Public track record with entry, horizon, outcome, hit rate — no invented PnL
- Judge/demo mode page with 3-click path
- SoSoValue / SoDEX brand theme (`#FF4F20`, `#FF7637`, `#7F2711`, ink greys)
- Unique FlowSentinel logo (sentinel aperture / FlowRadar)
- Unit tests for risk engine + signal logic

### Integration endpoints
- SoSoValue: `GET /etfs/summary-history`, `GET /news/hot`, `GET /indices/{ticker}/market-snapshot` (header `x-soso-api-key`)
- SoDEX: public `GET /markets/tickers`; authenticated `POST /orders` on testnet when keys set
