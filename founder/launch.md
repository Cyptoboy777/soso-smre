# Launch plan: SoSwapDEX (no dates invented; start from today, 2026-11-15)

## Step 1: real test before more building
Success line (set before running): 10 real non-builder users each complete one mainnet swap within 14 days, with the fee approved. Compare with the board's condition list. If fewer than 5 finish, fix onboarding before adding features.

## Step 2: countdown
Week 1: you do one real small mainnet swap; one real WalletConnect session on a phone; one real Gemini check. Record every failure (critical path: if the swap fails, nothing else matters).
Week 1: set Vercel env vars (GEMINI_API_KEY, NEXT_PUBLIC_BUILDER_ID/FEE, NEXT_PUBLIC_WC_PROJECT_ID, SOSOVALUE_API_KEY), deploy, fund builder account (100 vUSDC Spot + Perps).
Week 2: watch 3 to 5 people use it for 5 minutes each, in person or on a call. Fix the first thing each stumbles on.
Week 2: share the share-card of real trades in SoDEX communities (follow each community's rules; no profit promises).
Week 3: first review (below).

## Step 3: day one
Post the live link; you watch the first swaps; check Vercel logs and the SoDEX order response for errors; keep a rollback (previous Vercel deployment).

## Step 4: first 30 days
Track: users who connect, enable trading, approve the fee, complete a swap (the funnel); total volume against the ~60,000 USD needed for 5 points (estimate). Days 7, 14, 30: where do users drop? Is the safety check shown and read? Cut the skill nobody opens.
