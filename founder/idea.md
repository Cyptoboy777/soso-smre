# SoSwapDEX

- What it is: A non-custodial trading interface on the SoDEX mainnet spot order book, with SoSoValue news/ETF/sector data and Gemini-powered trade-safety skills (trade check, position size, portfolio health, journal, alerts, brief).
- Who it is for: Retail crypto traders who use or want to try SoDEX/ValueChain and want simpler onboarding, clearer costs and pre-trade safety checks. Exact segment still to be validated.
- What it sells, at what price: Free to use. Revenue is a SoDEX builder fee on each swap, currently planned at 3 bp (NEXT_PUBLIC_BUILDER_FEE=30, tenths of a bp), that the user approves once.
- Where and how: Web app and installable PWA on Vercel; wallets via EIP-6963, WalletConnect and mobile wallet browsers; keys stay server-side.
- Budget and constraints: Solo builder, no marketing budget stated; builder account needs at least 100 vUSDC in Spot and Perps; entered in the SoDEX Builder Race (ranked by builder fees and authorized users; buildsoso.xyz has no public API).
