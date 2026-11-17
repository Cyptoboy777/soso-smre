# SoSwapDEX

Non-custodial trading interface on the **SoDEX mainnet spot order book** with **SoSoValue** news / ETF flows / sectors and an animated **AI assistant** (orb + animal bot faces). Next.js 16 + React 19 (App Router, Node ≥ 20.9) · framer-motion page/card/tab transitions · Tailwind · lucide-react. Deploys to Vercel as-is. All rights reserved; see LICENSE (source shared for review and judging only).

| | |
| --- | --- |
| **Site** | https://soswapdex.xyz (DNS pending) |
| **Live app** | https://soswap-sodex.vercel.app |
| **Repo** | https://github.com/Cyptoboy777/soso-smre |
| **Builder Race** | https://www.buildsoso.xyz (builder ID `2674`) |
| **Guide demo** | https://youtu.be/uuOAIz47hjU |

Watch the guide demo at https://youtu.be/uuOAIz47hjU, or open the live app for current screens of Swap, Markets, Skills and the AI assistant.

- **Swap** with live Route Preview (walks the real SoDEX order book), limit orders, chart, order book, a safety strip, and a cost receipt before you confirm
- **Markets**: every SoDEX spot pair, SoSoValue news, ETF flows, sector moves, and a local watchlist
- **Skills**: Trade Check, Position Size and Portfolio are deterministic code in `lib/risk.ts`. Journal and Price Alerts are also in this tab. Gemini only explains those results; it cannot override a grade or place an order.
- **SoSwapDEX AI**: floating assistant with six animal faces (fox, bull, bear, owl, cat, panda). It reads a live SoDEX + SoSoValue snapshot server-side. If `AI_API_KEY` is unset, it uses `GEMINI_API_KEY`.
- **Cross-Chain (Mirror)**: indicative estimate only (not an atomic swap)
- **Bots (Drafts)**: DCA / Grid / Signal dry-run previews. They never send orders.

## How secrets are kept safe

| Secret | Where it lives | Reaches the browser? |
|---|---|---|
| `SOSOVALUE_API_KEY` | Vercel env var, used only in `app/api/soso` and `app/api/assistant` | **No** |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | Vercel env var, used only in `app/api/assistant` | **No** |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Vercel env var, used in `app/api/skills` and as the assistant fallback | **No** |
| Users' wallets / seed phrases | Never requested | n/a |
| Users' SoDEX trading key | Generated in the user's own browser tab (sessionStorage), signs orders locally | Stays in that tab; only signatures are sent |

- `.env*` files are git-ignored (only `.env.example` is committed). Never use the `NEXT_PUBLIC_` prefix for a secret.
- `/api/soso` exposes only three read-only SoSoValue endpoints and caches them at the edge, so visitors can't drain your quota.
- `/api/sodex` only forwards `GET/POST/DELETE /api/v1/spot/**` and key registration, to the two official gateways.
- `/api/assistant` is rate limited per IP (15 msgs/min, best effort in memory). For strict limits add Vercel KV / Upstash.

## Run locally

```bash
npm install
cp .env.example .env.local      # fill in the values
npm run dev                     # http://localhost:3000
```

## GitHub

This project already lives at https://github.com/Cyptoboy777/soso-smre (default branch: `main`). Vercel production auto-deploys from `main`.

```bash
git add -A
git status                  # confirm no .env file is listed
git commit -m "Your message"
git push origin main
```

## Deploy on Vercel

1. vercel.com → **Add New… → Project** → import the GitHub repo (Framework: Next.js, nothing to change).
2. **Environment Variables** (Production + Preview):
   - `SOSOVALUE_API_KEY` (news, ETF flows, sectors)
   - `GEMINI_API_KEY` (Skills explanations and, if `AI_API_KEY` is empty, the SoSwapDEX AI chat). Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`)
   - Optional: `AI_API_KEY`, `AI_MODEL`, and `AI_BASE_URL` if you want a non-Gemini provider for the assistant
   - `NEXT_PUBLIC_BUILDER_ID` and `NEXT_PUBLIC_BUILDER_FEE` (public by design; `10` = 0.01%)
   - Optional: `NEXT_PUBLIC_WC_PROJECT_ID` for WalletConnect
3. **Deploy.** Without a variable, that feature shows an honest empty state instead of fake data.
4. After changing env vars, redeploy.

## Before you call it production-ready

- Test a **tiny** real swap on mainnet with a small balance first. The signed-order path was built from the official SoDEX docs/SDK but could not be exercised against mainnet from the build environment.
- The trading key is a "hot key": its permissions are set by SoDEX. Users should fund only what they intend to trade and revoke keys at sodex.com/apikeys.
- SoSwapDEX is independent and not operated by SoDEX. Keep the footer disclaimer.

## Security notes
- All secrets (`SOSOVALUE_API_KEY`, `GEMINI_API_KEY`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`) are **server-side env vars only** — set them in Vercel → Settings → Environment Variables. Never prefix them with `NEXT_PUBLIC_`. `.env*` is gitignored.
- Browser calls go through allowlisted proxies (`/api/sodex`, `/api/soso`, `/api/assistant`) with body caps, timeouts and per-IP rate limits (in-memory, best effort per serverless instance).
- Response headers: CSP (`connect-src 'self'`, image CDNs allowlisted), HSTS, COOP, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy.
- The SoDEX API key is a hot key kept in `sessionStorage` for the tab only. Use a key with the minimum permissions SoDEX allows, and verify on SoDEX whether it can withdraw.
- Order signing against mainnet has not been exercised from the build sandbox: test with tiny amounts (or testnet) first.

## Skills tab (risk checks + Gemini)
- **Trade Check, Position Size, Portfolio** are deterministic code in `lib/risk.ts` (no AI, no cost). Every safe / caution / high-risk grade comes from there.
- **Gemini** (`/api/skills`, key in `GEMINI_API_KEY`, server-side only) only *explains* those results and writes the Market Brief, News Impact and Plan Review. It is told never to give buy/sell calls, predictions or "no loss" promises, and can't override a grade.
- Nothing in Skills places an order. No tool can guarantee against losses; the UI says so.

## Builder code: earning points (buildsoso.xyz)
The SoDEX Builder Race ranks apps by **builder fees** and **authorized users**. SoSwapDEX tags every order with your builder code:
1. Create/fund your builder account on SoDEX: it needs **≥ 100 vUSDC in both Spot and Perps**. Its account ID is your *builder ID*.
2. Set `NEXT_PUBLIC_BUILDER_ID=<your account id>` and `NEXT_PUBLIC_BUILDER_FEE` (tenths of a bp; `10` = 1 bp = 0.01%) in Vercel and redeploy. These values are public by design.
3. Users approve the fee once (wallet signature `ApproveBuilderFeeAction`, no gas) from *Get started* or the wallet menu, and can revoke it. Only approved users' orders carry `builder: {id, fee}` (last field of the signed batch, `id` before `fee`).
4. Track earnings at buildsoso.xyz. The fee is shown on every swap confirmation.

## Mobile
- **Installable app (PWA):** manifest, icons and a service worker (`public/sw.js`, never caches `/api`). Android/desktop Chrome show *Install app*; iOS shows the Share → Add to Home Screen steps.
- **Wallets on phones:** *Connect wallet* offers MetaMask / Trust / Coinbase / OKX deep links that reopen SoSwapDEX inside the wallet's browser, plus a copy-link button.

## Journal skill
*Skills → Journal* reads your latest 100 SoDEX fills and shows volume, fees, maker share and realised P&L (FIFO, over that window only; unmatched sells are excluded and unrealised gains are not counted). `journalStats` in `lib/risk.ts` is pure and unit-tested; Gemini can optionally coach on the numbers.

## Safer swaps
- **Safety strip** under the Swap button runs the same code checks as *Skills → Trade Check* on the live books (worst leg wins). A "High risk" grade adds a warning to the confirm step; it never blocks you.
- **Cost receipt** in the confirm step itemises price impact, SoDEX fee and the SoSwapDEX fee in dollars, plus the total cost as a % of the order.
- **Price alerts** (*Skills → Price Alerts*) are stored on the device and checked while SoSwapDEX is open; browser notifications are optional.

## Growth features
- **Share card:** after a confirmed swap, the confirm dialog offers *Share* / *Download image*. The PNG is drawn in the browser (`components/shareCard.ts`), contains no address or balances, and is never uploaded.
- **Watchlist:** star pairs in Markets; Home lists them with price, 24h change, a *Trade* button and an alert bell that opens *Skills → Price Alerts*.
- Builder Race standings are at [buildsoso.xyz](https://www.buildsoso.xyz). A public JSON feed is at `https://www.buildsoso.xyz/api/leaderboard`. Earnings are not shown in-app; check the leaderboard on the site.

## WalletConnect (phone wallets + QR)
Set `NEXT_PUBLIC_WC_PROJECT_ID` (free at https://cloud.reown.com, public by design) in Vercel and redeploy. *Connect wallet* then shows a WalletConnect option that opens the QR / wallet-list modal; sessions are restored silently on return. The library loads only when tapped, and the CSP only allows WalletConnect hosts when the id is set.
Known advisory: `npm audit` reports a `zod` memory-exhaustion DoS (<4.6.6) inside WalletConnect's dependency tree. It only affects the browser tab of the user who opens the WalletConnect modal. Re-check `npm audit` when WalletConnect ships an update.

## Wallet picker and token logos
- *Connect a wallet* is a two-pane picker: wallets detected on the device (real icons via EIP-6963) under **Installed**, then **Popular** (install links on desktop, wallet-browser deep links on phones), WalletConnect, and a plain-language "What is a wallet?" panel.
- Popular-wallet badges are letter badges, not official logos. Detected wallets show their own real icon.
- SoDEX's API has no icon field, so token logos come from CoinCap / spothq / Parqet, with SOSO and XAUT from CoinGecko's CDN (`ICON_OVERRIDES` in `app/page.tsx`). Anything without a logo shows a letter badge.

## How signing works (any wallet from the picker)
1. **Connect:** shares only your address.
2. **Enable trading (one wallet signature):** an EIP-712 `AddAPIKey` message registers a fresh trade key. SoDEX verifies it on ValueChain (chain id 286623). If your wallet insists the typed-data chain equals its active network, SoSwapDEX asks it to add/switch to ValueChain (RPC `https://mainnet.valuechain.xyz`, symbol SOSO, as published in SoDEX's support docs), as sodex.com does. Works with MetaMask-style wallets and WalletConnect.
3. **Orders:** signed locally by the trade key, so there are no wallet pop-ups per trade. The key lives in `sessionStorage` for this tab only.
4. **SoSwapDEX fee (optional, one signature):** `ApproveBuilderFeeAction`, same network handling.
Testnet's RPC isn't published, so on testnet SoSwapDEX can't auto-add the network: add it manually or import a key from sodex.com/apikeys.
