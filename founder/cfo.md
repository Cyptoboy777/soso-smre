# CFO's note

- **The margin:** 92% at the plan volume, contribution $0.29 per $1,000 swapped. This is high only because costs are tiny; revenue is what is small.
- **The line to watch:** volume. At 3 bp, $50,000 a day (an ESTIMATE, not data) earns about $450 a month. The 5-point goal from the Builder Race, at the ~36 USDC per point estimate, needs about $180 of fees = about $60,000 of total swapped volume at 3 bp (computed: 180 / 0.0003). That is the number to chase first.
- **Cash:** $203 before it pays for itself, but $200 is builder collateral (100 vUSDC Spot + 100 Perps), not a spent cost.
- **Three ways to improve:** (1) volume, the only big lever: Volume -20% cuts year 1 profit from $2,222 to $1,730; (2) fee level: Price -10% costs $255 of year 1 profit, so a raise only helps if users still swap (the board asks what the native fee is; unknown); (3) hold AI cost down: +15% unit costs moves year 1 by only $13, not worth effort.
- **Board money conditions:** not met. Volume, native fee level and builder-term risk are open questions; no real data exists yet.
- An accountant should check tax treatment of fee income. Not financial, legal or tax advice.

# Unit economics: SoSwap (builder-fee revenue model; ALL volumes are ESTIMATES, not data)

Every number below comes from the input file. Nothing is looked up or guessed.

## One USD 1,000 swapped

| line | per USD 1,000 swapped |
| --- | ---: |
| Price | $0.30 |
| Gemini API cost per $1,000 swapped (estimate: ~1 check per $500) | -$0.01 |
| **Contribution** (what each USD 1,000 swapped leaves to pay the fixed costs) | **$0.29** (97%) |

## The margin that matters

Fixed costs: $20 a month (Vercel + domain (estimate, free tier possible) $20).

- **Break-even: 3 USD 1,000 swappeds a day.** Below that you lose money every month.
- **Profit margin at your plan** (50 a day): **92%** of every sale, after every cost.

## Year 1, month by month

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

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 92% | 3 | $2,222 |
| Price -10% | 91% | 3 | $1,967 |
| Volume -20% | 91% | 3 | $1,730 |
| Unit costs +15% | 92% | 3 | $2,209 |

No red flags in these numbers. They are only as good as the inputs: check every cost against a real quote.
