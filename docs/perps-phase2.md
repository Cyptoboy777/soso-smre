# Perps phase 2: checklist before any perps code

Status: superseded. Perps shipped (risk setup, orders, TP/SL edit, builder fee). The items below remain the live-verification checklist and are not yet recorded as done.
Date written: 2026-11-17. SoDEX docs index: https://docs.sodex.com/llms.txt

## Must confirm first (none of these is verified yet)

- [ ] **1. Perps TP/SL fields and builder fee.**
  Read the Perps REST API reference (`/for-developers/api-reference/trading-api/rest-v1/sodex-rest-perps-api`) and the schema. Record the exact field names for BRACKET, ATTACHED_STOP and position-level reduce-only STOP orders, and whether the builder fee applies to perps orders and to triggered TP/SL fills.
  Known from docs: TP/SL trigger on mark price only and execute as market orders (https://docs.sodex.com/trading-mechanics/take-profit-and-stop-loss-orders-tp-sl).
  Result: ____
- [ ] **2. Can a trade key be blocked from moving funds?**
  The API key docs list `transferAsset` among actions a key can sign and mention `addPermissionedAPIKey` without saying what it can restrict (https://docs.sodex.com/for-developers/developers/trading/api-keys-and-nonces). The trade key lives in sessionStorage, so a leaked key could move funds if transfers are allowed. Ask SoDEX or test with a permissioned key that has TRANSFER and WITHDRAW off but TRADE and CANCEL on. Do not ship perps until a trade-only key works.
  Result: ____
- [ ] **3. Does a stop survive a closed tab? (tiny real order test)**
  On mainnet at the minimum notional (10 USDC): place a BRACKET entry with an exchange stop and TP, confirm both show as open orders on the exchange, close the browser tab, wait 2 minutes, then check from another device that the stop and TP are still resting. Also test a partial fill of the parent and confirm what happens to the children.
  Result: ____

## Rule: schedule-cancel must be off while a perps stop rests

SoDEX schedule-cancel cancels all open orders at the set time, and the docs do not exclude resting TP/SL stops. Treat it as cancelling them.

- [ ] The "safety switch" option (`soswap.deadman`, off by default) must be forced off, and its toggle disabled with a plain explanation, whenever the account has an open perps position or a resting perps stop/TP.
- [ ] Never call schedule-cancel for a perps symbol while a protective stop rests.
- [ ] Add a test: with a perps stop open, enabling the switch is refused.

## Other limits to keep

- Leverage at most 3x, isolated margin, liquidation distance at least 3 times the stop distance.
- No new entry or size increase without a user tap. User keys are never sent to a server.
- Rate limits (SoDEX docs): API key 600 orders/min and 20 orders/s; reads 1200 IP weight/min (klines cost 20), so batch and cache scans.
- Paper mode first; real money only after the backtest and paper gates in the bot design.

Nothing in this file is financial advice. Every strategy can lose money.
