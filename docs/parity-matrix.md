# FlowSentinel parity and gaps

Research date: 8 November 2026. Competitor screenshots are an observed inventory, not proof that every control executes. No competitor source, license, layout, or asset was reused. The generated trading notes (random prices, fake fills, `/api/bot`) were not implemented.

| Capability | Evidence | FlowSentinel |
| --- | --- | --- |
| ValueDesk `/trade` book, spread, cumulative size, buy/sell balance | Observed terminal | Implemented on `/trade` from the SoDEX public book for the same network as the order. Empty and stale states are explicit. |
| ValueDesk chart, timeframes, indicators, drawings, liquidation heatmap, widgets | Observed | Deferred. Existing desk chart remains. No new heatmap or drawing tools. |
| ValueDesk perps ticket: leverage, cross, stop, algo, reduce-only, TP/SL, liquidation, margin | Observed UI | Unavailable. Perps use `POST /api/v1/perps/trade/orders` and a different payload. This ticket prepares spot only. |
| ValueDesk spot buy/sell, market and limit, market IOC | Observed | Implemented for spot limit (GTC) and market (IOC) on `POST /api/v1/spot/trade/orders/batch`. |
| ValueDesk positions, open orders, balances, history while disconnected | Observed empty prompts | Implemented as honest unavailable until a wallet is connected. No zeroed success metrics. |
| ValueDesk `/explore`, `/scan`, cohorts, wallet search | Observed nav | Unavailable. No documented public source for those cohorts was connected. |
| ValueDesk `/copy`: copy and counter-trade, PnL cards, scores | Observed UI. Execution not tested. | Unavailable. No permitted public source of other traders, and this desk does not place orders for someone else. |
| ValueDesk Bots / Get access | Observed gated nav | Unavailable. No unattended bot. |
| sodextra.xyz `/app` Maker Volume, Grid, Taker Volume, Spot Edge | Observed labels | Not implemented. Two-sided quoting and taker-volume loops would fight the self-trade and no-wash rules. |
| sodextra Edge and Funding Carry, marked testing | Observed | Unavailable. |
| sodextra `/app/new` four steps | Only step 1 inspected | Not a bot wizard. FlowSentinel uses connect, review, sign, receipt. |
| sodextra `/app/history` | Zeros, loading, unstable server | Not copied. History comes from the account read or stays unavailable. |
| sodextra `/guide` trade-only key, 0.2 bp, stop that cancels or keeps a position | Docs on their site, not executed | Not copied. No key is created. App fee is optional, in tenths of a basis point from this deployment, and omitted unless chosen before signing. Cancel is its own signature. A filled size is not described as closed. |
| sodexetra.xyz | HTTP 500 / TLS failure | Not treated as the same site. |
| SoDEX master-wallet signing without `X-API-Key` | Official docs | Implemented. The server does not create or store a key. |
| SoDEX acceptance versus fill, no blind retry | Official spot batch response | Implemented. Missing order id stays ambiguous. |
| Builder 2674 and 100 vUSDC | Docs. Ownership and eligibility were not rechecked | The id is used only if this deployment already has it and the user opts in. The balance requirement is the builder account's, not the customer's. |
| Evidence timeline, cost and stress, execution receipt | Original | Implemented from cited live news when the feed is live, the visible book, and the exchange response. Fallback headlines are not shown as evidence. |
