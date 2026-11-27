# SoSwapDEX

**Trade smarter on SoDEX. Your keys, your wallet, with risk checks and an AI co-pilot that explains before you sign.**

SoSwapDEX is a non-custodial trading interface for **SoDEX mainnet** (spot and perpetuals) powered by **SoSoValue** news, ETF flows and sector data. Code computes every price, size, liquidation and risk grade. AI only explains. Nothing trades without your wallet signature, and nothing ever trades automatically.

| | |
| --- | --- |
| **Live app** | https://soswapdex.xyz |
| **Repo** | https://github.com/Cyptoboy777/soso-smre |
| **Guide demo** | https://youtu.be/uuOAIz47hjU |
| **Builder Race** | https://www.buildsoso.xyz (builder ID `2674`) |
| **Stack** | Next.js 16 (App Router) · React 19 · Tailwind · framer-motion · TypeScript · deploys to Vercel from `main` |
| **Checks** | 179 unit tests (`npm test`), `tsc --noEmit`, production build, browser checks at 390px and 1280px |

## Why it is different

1. **Pre-trade safety, not just a swap box.** Every swap shows a live route walked through the real order book, a full cost receipt (price impact, SoDEX fee, app fee, total in dollars and %), and a code-computed Trade Guard grade before you sign.
2. **Perps with guard rails.** A risk-first Perps page sizes the position from the risk you choose, blocks setups where liquidation is too close to the stop, and shows what you can lose before you sign.
3. **AI that cannot overrule the code.** Grades come from deterministic code. Gemini only explains them, never predicts, never says buy or sell, and cannot place orders.
4. **A daily market story.** One article per day, written from SoSoValue headlines and SoDEX prices, with the sector, the linked tokens and a 24h chart. It is generated once and shared by everyone, so it costs no per-user AI credits.
5. **A talking 3D assistant.** A CSS-3D robot that follows your pointer, speaks replies in a robot voice, and fills the Swap form from a typed or spoken command. It never signs or sends.
6. **Honest by design.** Missing data hides the line instead of showing a fake number. No profit promises anywhere.

## Features

### Trade
- **Swap (spot):** market and limit orders on every SoDEX spot pair, live Route Preview over the order book, chart, order book, safety strip, cost receipt, optional share card after a confirmed swap.
- **Perps (futures):** market list with live mark, funding and open interest; AI-free risk setup (side, entry, stop, target, size, leverage) with a *Good to go / Wait / Risky* verdict; order preview with margin, fees and estimated liquidation; open, close, cancel; **Edit TP/SL** on an open position; daily-loss cap and max-open-positions limits; liquidation must be at least 2x further than the stop; leverage hard-capped at 10x (default 2x).
- **Cross-Chain:** add funds from another chain or withdraw to one. You sign every route transaction. Quotes are estimates.
- **Bots (drafts):** DCA, Grid and Signal dry-run previews with backtests on real candles and real fees. They never send orders.
- **Portfolio and Home:** balances, positions, a *Get started* checklist, a local watchlist with price, 24h change, Trade button and alert bell.

### Wealth and SoDEX Rewards
- **Wealth hub** (own tab) connects to the SoDEX Rewards APIs: sign in with a wallet message (`auth/nonce` + `auth/verify`, no gas, no funds move), then see your **SoPoints** summary and this week's info, and your **Blind Box** treasures.
- **Claim Blind Box rewards** with one tap (`lottery/treasure/open`) and watch the claim job status until it finishes.
- All calls go through the same-origin gateway, which only forwards the specific Rewards paths it allowlists. The sign-in token stays in your tab.

### Markets and news
- Every SoDEX spot pair with live prices, SoSoValue news, ETF flows and sector moves.
- **SoSwap Market Story:** the daily article described above, with sources, a token chart, a Share story / Download image card (1200x630, drawn on your device, no wallet data) and a disclaimer.

### Skills (risk tools)
| Skill | Type | What it does |
| --- | --- | --- |
| Trade Check | code | Grades a planned trade on the live book (safe / caution / high risk) |
| Position Size | code | How big to trade for the risk you choose |
| **Liquidation** | code | Where a leveraged position would liquidate and the highest leverage that keeps a safe gap from your stop |
| Portfolio | code | Concentration and stablecoin buffer |
| Fund my SoDEX / Cheapest withdraw / Check a route | code | Cross-chain helpers |
| Journal | code | Last 100 fills: volume, fees, maker share, realised P&L (FIFO, that window only) |
| Price Alerts | code | Stored on the device, optional browser notifications |
| Market Brief / News Impact / Plan Review | AI | Gemini explains live data or your plan; no predictions, no orders |

### SoSwapDEX AI assistant
- **3D robot** (default) built with CSS 3D, no extra package. It idles, follows the pointer, nods and moves its mouth while talking. Orb and animal faces are still selectable. Respects reduced motion.
- **Robot voice (optional, off by default):** replies are read aloud with the browser's speech engine (low flat pitch plus a small blip). Voice mode also sends your spoken question automatically. The mic uses your browser's speech service.
- **Commands:** type or say `swap 10 USDC to ETH`, `buy 50 dollars of BTC`, `buy BTC with 100 USDC`, `sell 0.1 BTC`. The Swap form is filled; you review the route and sign yourself.
- Reads a live SoDEX + SoSoValue snapshot on the server, refuses to ask for seed phrases, never gives price predictions.

### Monetisation (all optional)
- **Builder fee** (SoDEX Builder Race): fully integrated for Spot and Perps. Approved users' orders carry `builder: {id: 2674, fee}` (0.01% with `NEXT_PUBLIC_BUILDER_FEE=10`). The fee prompt and fee lines appear only after the builder account is funded (SoDEX requires 100 vUSDC in Spot and 100 in Perps) and `NEXT_PUBLIC_BUILDER_ENABLED=1` is set. Until then no fee is shown or charged. If SoDEX refuses an approval, users can still trade and nothing is charged.
- **Referral link** and **tip address** boxes appear only when `NEXT_PUBLIC_REFERRAL_URL` / `NEXT_PUBLIC_TIP_ADDRESS` are set.
- **Route fee** on cross-chain routes exists but is off (`NEXT_PUBLIC_ROUTE_FEE_BPS=0`).

## Security model

| Secret | Where it lives | Reaches the browser? |
| --- | --- | --- |
| `SOSOVALUE_API_KEY` | Server env only | No |
| `GEMINI_API_KEY`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Server env only | No |
| `RELAY_API_KEY`, `UPSTASH_*` | Server env only | No |
| Wallet seed phrase / private key | Never requested | n/a |
| SoDEX trade key | Generated in the user's tab (`sessionStorage`), signs orders locally | Stays in the tab; only signatures leave |

- **Non-custodial:** the server never holds user keys and never signs for users.
- **Same-origin gateway:** all SoDEX traffic goes through `/api/sodex/**` (allowlisted paths, body caps, timeouts, rate limits, 403 for foreign origins on non-GET, `Cross-Origin-Resource-Policy: same-origin`). No wildcard CORS.
- **AI routes** (`/api/skills`, `/api/ask`, `/api/assistant`) accept same-origin calls only, are rate limited per IP, and share one daily budget (`AI_DAILY_CAP`, default 1500). Add Upstash Redis for strict limits across instances.
- **Daily article** (`/api/daily-article`) is cached for 24 hours, retries on failure are capped per hour, and failures are never cached.
- **Headers:** CSP, HSTS, COOP, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy.
- **Honest limits:** the trade key is a hot key (permissions are set by SoDEX), so fund only what you intend to trade and revoke keys at sodex.com/apikeys (limit 10 per account). `npm audit` reports transitive advisories inside WalletConnect's dependency tree (only affects the tab that opens the WalletConnect modal); the fix is a breaking downgrade, so it is not applied.

## How signing works
1. **Connect:** shares only your address (browser wallets, WalletConnect, mobile wallet deep links).
2. **Enable trading (one signature):** an EIP-712 `AddAPIKey` registers a fresh trade key on ValueChain (chain id 286623).
3. **Orders:** signed locally by the trade key (EIP-712, spot and futures domains), so there is no wallet pop-up per trade.
4. **Builder fee (optional, one signature):** `ApproveBuilderFeeAction`, no gas, revocable.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm test                     # 179 unit tests
npx tsc --noEmit
```

## Environment variables
See `.env.example` for the full list. Without a variable, that feature shows an honest empty state instead of fake data.

| Variable | Purpose |
| --- | --- |
| `SOSOVALUE_API_KEY` | News, ETF flows, sectors, daily article |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Skills, daily article, assistant fallback |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Optional non-Gemini assistant provider |
| `NEXT_PUBLIC_BUILDER_ENABLED`, `NEXT_PUBLIC_BUILDER_ID`, `NEXT_PUBLIC_BUILDER_FEE` | Builder fee (public by design; `10` = 0.01%). The builder account needs at least 100 vUSDC in Spot and 100 in Perps |
| `NEXT_PUBLIC_REFERRAL_URL`, `NEXT_PUBLIC_TIP_ADDRESS` | Optional support box |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect |
| `RELAY_API_KEY`, `NEXT_PUBLIC_ROUTE_FEE_BPS` | Cross-chain routing |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `AI_DAILY_CAP` | Shared rate limits and AI budget |

## Deploy
Import the repo in Vercel (Framework: Next.js), set the variables for Production and Preview, deploy, and redeploy after changing any variable. Production auto-deploys from `main`.

## Mobile
Installable PWA (manifest, icons, service worker that never caches `/api`), layouts checked at 390px, and wallet deep links for MetaMask, Trust, Coinbase and OKX that reopen SoSwapDEX inside the wallet browser.

## Project map
- `app/page.tsx` main app (views, Perps, Swap, Skills), `components/wealth-hub.tsx` Wealth and Blind Box · `app/api/*` server routes (`sodex`, `soso`, `skills`, `ask`, `assistant`, `daily-article`, `route`)
- `lib/perps.ts` Perps maths (liquidation, sizing, guards) · `lib/risk.ts`, `lib/trade-guard.ts` risk grades · `lib/voice.ts`, `lib/voice-command.ts` voice and commands
- `components/Robot3D.tsx`, `SoSwapAI.tsx` assistant · `components/shareCard.ts` share images
- `tests/` unit tests for the maths, parsers, key handling and rate limits

## Status and honest notes
- Automated tests and browser checks (with mocked SoDEX responses) pass. Test a **tiny** real order first: order signing, TP/SL and fee approval depend on live SoDEX behaviour.
- **Builder fee status:** the integration is complete, but fee collection starts only once the builder account is funded. Until then the app shows no fee line and trades without one.
- Tested on mainnet with small amounts by the owner. Keep amounts small until you trust your own setup.
- Trading can lose money. Nothing in the app is financial advice, and no tool can guarantee against losses.
- SoSwapDEX is independent and not operated by SoDEX or SoSoValue.

## License
All rights reserved. Source is shared for review and judging only. See `LICENSE`.
