# Third-party: day-trader-skill

Source: https://github.com/jakeschincariol/day-trader-skill  
Copyright (c) 2026 Jake Schincariol  
License: MIT (see `LICENSE` in this folder)

FlowSentinel adapts selected skills (Chart Scanner, News Monitor, Entry Timer,
Exit Planner, Time Machine, Risk Manager, Budget/position sizer, Order ticket
prefill, Price Alerts) for SoDEX crypto + SoSoValue news. Pelosi Tracker and
Earnings Analyst are intentionally not ported (US-equities only).

Algorithms are reimplemented in TypeScript; Monte Carlo seeds are
deterministic within FlowSentinel but not bit-identical to CPython's
`random.Random`.
