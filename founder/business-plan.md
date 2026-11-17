# SoSwapDEX · Business plan

**Verdict: Profitable**

- ✓ Each USD 1,000 swapped earns $0.29 before fixed costs (97% contribution).
- ✓ Year 1 operating profit: $2,222.

| key number | |
| --- | ---: |
| Price | $0.30 a USD 1,000 swapped |
| Profit margin at plan | 92% per USD 1,000 swapped |
| Break-even | 3 USD 1,000 swappeds a day |
| Year 1 operating profit | $2,222 |
| Startup spend | $200 |
| Cash needed before it pays for itself | $203 |
| Startup money earned back | month 5 |

## The idea

- What it is: A non-custodial trading interface on the SoDEX mainnet spot order book, with SoSoValue news/ETF/sector data and Gemini-powered trade-safety skills (trade check, position size, portfolio health, journal, alerts, brief).
- Who it is for: Retail crypto traders who use or want to try SoDEX/ValueChain and want simpler onboarding, clearer costs and pre-trade safety checks. Exact segment still to be validated.
- What it sells, at what price: Free to use. Revenue is a SoDEX builder fee on each swap, currently planned at 3 bp (NEXT_PUBLIC_BUILDER_FEE=30, tenths of a bp), that the user approves once.
- Where and how: Web app and installable PWA on Vercel; wallets via EIP-6963, WalletConnect and mobile wallet browsers; keys stay server-side.
- Budget and constraints: Solo builder, no marketing budget stated; builder account needs at least 100 vUSDC in Spot and Perps; entered in the SoDEX Builder Race (ranked by builder fees and authorized users; buildsoso.xyz has no public API).

## Summary

**Verdict caveat:** compile.py says "Profitable", but it only checks my ESTIMATED inputs (volume, costs) and no buyer panel or competitor research was run. Treat it as "cheap to run", not "proven".

SoSwapDEX is a free non-custodial SoDEX spot front end with pre-trade safety checks, earning a 3 bp builder fee. Costs are about $20 a month, so break-even is tiny; revenue is the limit (about $450 a month at an assumed $50,000 a day).

Board: 2 fund if, 1 pass, average 4.0. All three flagged: nothing verified on mainnet, SoDEX's own site sells the same swap, no distribution. Offers and Product see a wedge in "check before you swap"; Monopoly says it is copyable.

Biggest risk: no reason to choose SoSwapDEX over SoDEX's own site. Fix: make the safety check the one thing and show it before every swap.

This week: do one real small mainnet swap, one real WalletConnect session on a phone, one real Gemini call, then have 3 people try it.

## What the board said

**Vote:** 2 fund if, 1 pass. Average score 4.0 / 10 (Offers 4, Monopoly 3, Product 5).

### Risks raised by more than one member (go first)
1. **Nothing verified end to end.** No real mainnet trade, WalletConnect relay or Gemini call yet (all three).
2. **SoDEX's own site and sodexextra.xyz sell the same swap.** Without a stated reason to choose SoSwapDEX, the fee is a cost, not a benefit (all three).
3. **No distribution and no validated segment.** No count of reachable users, no channel for the first 100 (Offers, Monopoly, Product).
4. **Too many things.** Terminal, research feed and six AI skills; no single "one thing" (Product, echoed by Offers' commodity point).

### Conditions (checklist)
- [ ] Complete one real mainnet swap, one real WalletConnect session, one real Gemini call; record failures.
- [ ] Name the exact segment and show a sourced count of reachable SoDEX/ValueChain traders (open: no number yet; `/founder-competitors`, `/founder-consumer`).
- [ ] State a concrete reason to choose SoSwapDEX over SoDEX's site, with a guarantee (e.g. a warning is always shown before a flagged trade).
- [ ] Pick the one thing; demote the rest out of the main flow.
- [ ] Show fee and safety result plainly before every swap.
- [ ] 5 minutes of first-time use with a non-builder; report stumbles.
- [ ] 10 real users complete a swap.
- [ ] Say what happens to revenue if builder terms change (open: native fee level and volume unknown; `/founder-cfo`).

### Where members disagree
The Monopoly lens passes: checks are incremental, copyable in weeks, and the platform owns the customer. The Offers and Product lenses see a fundable wedge in pre-trade safety if it is proven and made the single focus.

### Strongest version the board can see
"Check before you swap": a mobile-first SoDEX front end whose one job is to show real cost, slippage and risk before every spot trade, then trade in a tap. News, ETF data, journal and alerts become secondary. It differs from the pitch, which is a full trading suite. Durable advantage, if any, would come from user trade history and a community, not from the checks themselves.

## The numbers

- **The margin:** 92% at the plan volume, contribution $0.29 per $1,000 swapped. This is high only because costs are tiny; revenue is what is small.
- **The line to watch:** volume. At 3 bp, $50,000 a day (an ESTIMATE, not data) earns about $450 a month. The 5-point goal from the Builder Race, at the ~36 USDC per point estimate, needs about $180 of fees = about $60,000 of total swapped volume at 3 bp (computed: 180 / 0.0003). That is the number to chase first.
- **Cash:** $203 before it pays for itself, but $200 is builder collateral (100 vUSDC Spot + 100 Perps), not a spent cost.
- **Three ways to improve:** (1) volume, the only big lever: Volume -20% cuts year 1 profit from $2,222 to $1,730; (2) fee level: Price -10% costs $255 of year 1 profit, so a raise only helps if users still swap (the board asks what the native fee is; unknown); (3) hold AI cost down: +15% unit costs moves year 1 by only $13, not worth effort.
- **Board money conditions:** not met. Volume, native fee level and builder-term risk are open questions; no real data exists yet.
- An accountant should check tax treatment of fee income. Not financial, legal or tax advice.

## Unit economics: SoSwapDEX (builder-fee revenue model; ALL volumes are ESTIMATES, not data)

Every number below comes from the input file. Nothing is looked up or guessed.

### One USD 1,000 swapped

| line | per USD 1,000 swapped |
| --- | ---: |
| Price | $0.30 |
| Gemini API cost per $1,000 swapped (estimate: ~1 check per $500) | -$0.01 |
| **Contribution** (what each USD 1,000 swapped leaves to pay the fixed costs) | **$0.29** (97%) |

### The margin that matters

Fixed costs: $20 a month (Vercel + domain (estimate, free tier possible) $20).

- **Break-even: 3 USD 1,000 swappeds a day.** Below that you lose money every month.
- **Profit margin at your plan** (50 a day): **92%** of every sale, after every cost.

### Year 1, month by month

| month | USD 1,000 swappeds a day | revenue | profit | cumulative (after $200 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | $18 | -$3 | -$203 |
| 2 | 4 | $36 | $15 | -$188 |
| 3 | 7 | $63 | $41 | -$147 |
| 4 | 10 | $90 | $67 | -$80 |
| 5 | 15 | $135 | $110 | $31 |
| 6 | 20 | $180 | $154 | $185 |
| 7 | 25 | $225 | $198 | $382 |
| 8 | 30 | $270 | $241 | $623 |
| 9 | 35 | $315 | $284 | $908 |
| 10 | 40 | $360 | $328 | $1,236 |
| 11 | 45 | $405 | $372 | $1,607 |
| 12 | 50 | $450 | $415 | $2,022 |

- **Year 1 operating profit: $2,222** on $2,547 of revenue.
- After the $200 startup spend: $2,022.
- Startup money earned back: month 5.
- Cash you need before it pays for itself: **$203**.

### What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 92% | 3 | $2,222 |
| Price -10% | 91% | 3 | $1,967 |
| Volume -20% | 91% | 3 | $1,730 |
| Unit costs +15% | 92% | 3 | $2,209 |

No red flags in these numbers. They are only as good as the inputs: check every cost against a real quote.

## Launch plan

### Step 1: real test before more building
Success line (set before running): 10 real non-builder users each complete one mainnet swap within 14 days, with the fee approved. Compare with the board's condition list. If fewer than 5 finish, fix onboarding before adding features.

### Step 2: countdown
Week 1: you do one real small mainnet swap; one real WalletConnect session on a phone; one real Gemini check. Record every failure (critical path: if the swap fails, nothing else matters).
Week 1: set Vercel env vars (GEMINI_API_KEY, NEXT_PUBLIC_BUILDER_ID/FEE, NEXT_PUBLIC_WC_PROJECT_ID, SOSOVALUE_API_KEY), deploy, fund builder account (100 vUSDC Spot + Perps).
Week 2: watch 3 to 5 people use it for 5 minutes each, in person or on a call. Fix the first thing each stumbles on.
Week 2: share the share-card of real trades in SoDEX communities (follow each community's rules; no profit promises).
Week 3: first review (below).

### Step 3: day one
Post the live link; you watch the first swaps; check Vercel logs and the SoDEX order response for errors; keep a rollback (previous Vercel deployment).

### Step 4: first 30 days
Track: users who connect, enable trading, approve the fee, complete a swap (the funnel); total volume against the ~60,000 USD needed for 5 points (estimate). Days 7, 14, 30: where do users drop? Is the safety check shown and read? Cut the skill nobody opens.

## Not done yet

- The competition: run /founder-competitors
- The buyer panel: run /founder-consumer
- Pricing: run /founder-pricing
- The offer: run /founder-offer
- Marketing: run /founder-marketing
- Brand: run /founder-brand
- Operations: run /founder-ops

_The panel is simulated buyers and the numbers are projections from your inputs. Confirm demand with real customers and costs with real quotes before you spend. Not financial, legal or tax advice._
