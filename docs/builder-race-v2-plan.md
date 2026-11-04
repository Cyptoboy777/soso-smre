# FlowSentinel Builder Race v2 plan

Date: 2026-11-04 (Asia/Calcutta)
Race: SoSoValue Wave 3 Builder Race (Nov 3 to Dec 1, 2026)
Leaderboard: https://buildsoso.xyz
Repo branch target: `builder-race-v2` off `builder-codes`

## What the leaderboard measures

From buildsoso.xyz standings (refreshed about every 30s):

| Column | Meaning |
| --- | --- |
| Users | Real wallets that approved / traded with the builder code |
| Builder fees | Cumulative builder fee revenue in vUSDC (protocol-reported) |
| Points Earned | Separate buildathon points (~36 USDC each, estimated) |
| Rank | Ordered by real user growth + builder fee revenue + product performance |

Race rules forbid wash trading, fake users, artificial volume, and fraudulent promotion.

Protocol fee mechanics (SoDEX docs):

- User approves max fee once (EIP-712 ApproveBuilderFeeAction, master wallet).
- Orders tag `builder: { id, fee }` (fee in tenths of a bp; 10 = 1 bp).
- Spot: no builder fee on the buying side. Perps: fee on both sides. Caps spot 2% / perps 0.2%.
- Public read endpoints (no signature):
  - `GET /api/v1/user/{owner}/builder/summary?accountID=`
  - `GET /api/v1/user/{owner}/builder/daily-chart?accountID=&limit=`
- Fields: `userCount`, `builderFee`, `tradeCount`, `tradeVolume`, plus daily series.

Current top projects (snapshot at research time): SoDextra (33 users / 33.5 fees), DRIFT, POD. SoDextra wins with frictionless connect → approve trade-only key → start a bot. Differentiator for FlowSentinel: AI thesis + Day Trader Desk + transparent builder stats + guided testnet first trade (honest, no custody).

## Competitive gap vs #1

SoDextra: maker bots, 3-step onboarding, clear non-custodial copy, very low fee (0.1 bp).
FlowSentinel already has: Builder Codes path, Day Trader Desk, AI advisor, kill switch, dry-run.
Missing for growth: guided onboarding, public stats page, shareable ideas/referrals, perps-first fee education, i18n, mobile polish.

## Ship list (genuine growth only)

1. Public `/stats` page + `/api/builder/fee-stats` proxying real SoDEX summary/daily for builder 2674. Empty state if address unset or API empty. Never invent numbers.
2. Guided onboarding: connect wallet → disclose + approve builder fee → guided first testnet trade (confirm required, size capped).
3. Perps-first UX: default messaging that fees apply both sides on perps; spot buys pay none.
4. Shareable AI trade-idea cards + `?ref=` referral links (client share / copy). No fake attribution volume.
5. Lightweight browser alerts entry from Day Trader Desk (already present; surface in nav/onboarding).
6. i18n: EN / ES / PT / ZH / FR only (no HI/TE).
7. Mobile polish + premium agency UI. Human copy, no em dashes, no `**` in public text.
8. Keep safety: SODEX_MAINNET_TRADING unset/off, user confirms every order, no secrets, no wash/bots.

## Out of scope / needs user decision

- Merging PR to `flowsentinel-wave3` or Production.
- Turning on `SODEX_MAINNET_TRADING`.
- Setting `SODEX_BUILDER_ADDRESS` in Preview env if not already set (required for live fee summary).
- Promoting FlowSentinel on social or the leaderboard (user-owned).

## Success checks

- Tests + lint + typecheck + build pass.
- Push to `builder-race-v2` only; do not merge; do not touch Production env.
- Preview Ready; key pages 200; `/api/builder/config` shows builderId 2674 and mainnetTradingEnabled false.

## Public product polish (added)

- No env var names, kill-switch jargon, dry-run/debug text, gateways, or stack traces in UI / public APIs.
- `/api/builder/config` returns only client needs (mode practice|live, fee percents, disclosures).
- Friendly generic errors; details logged server-side only.
- `poweredByHeader: false`, `productionBrowserSourceMaps: false`, strip console in production client.

## How to enable mainnet later (do NOT do until final OK)

### Preview (branch deploy of `builder-race-v2` or `builder-codes`)
Vercel project: **soso-smre** (team cryptoboys-projects-d555dcd8).
1. Set Preview env: `SODEX_BUILDER_ID=2674` (already), `SODEX_BUILDER_FEE=10`, `SODEX_BUILDER_MAX_APPROVAL=50`, `SODEX_MAX_NOTIONAL_USDC=10`.
2. Set Preview env: `SODEX_BUILDER_ADDRESS=<builder owner 0x…>` for `/stats` live protocol numbers.
3. Set Preview env: `SODEX_MAINNET_TRADING=1` only after explicit OK.
4. Redeploy the Preview for that branch. Confirm `/api/builder/config` shows `"mode":"live"` and `"tradingLive":true`.

### Production (https://flowsentinel-app.vercel.app)
Same Vercel project **soso-smre**. Production currently tracks default GitHub branch **`flowsentinel-wave3`** (not this PR).
1. Merge only after user OK: `builder-race-v2` (or its PR) into `flowsentinel-wave3` (or the branch Production is assigned to). Do not merge unprompted.
2. Set Production env (same keys as preview): `SODEX_BUILDER_ID`, fee/approval/notional, `SODEX_BUILDER_ADDRESS`, then `SODEX_MAINNET_TRADING=1`.
3. Leave server custodial testnet keys unset on Production unless intentionally needed for the old desk path.
4. Redeploy Production and verify real-funds warning appears in the trade panel and practice mode is gone.

Safety that stays on after enable: user wallet signatures only, per-order confirm, size cap, fee disclosure, no server custody of user keys.
