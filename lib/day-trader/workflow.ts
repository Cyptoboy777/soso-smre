import { formatPair } from '@/lib/display';
/**
 * Day-trader workflow: scan → news → entry → exit → Time Machine → budget → risk → ticket.
 * Order step only prefills the Builder Codes confirm screen; paper default; never auto-submits.
 */
import { fetchHotNews } from "@/lib/sosovalue";
import { findDailySetups, SETUP_LABELS, type SetupTag } from "@/lib/day-trader/scanner";
import { tagNewsForAssets, newsForSymbol } from "@/lib/day-trader/news-monitor";
import { checkEntry } from "@/lib/day-trader/entry-timer";
import { planExit } from "@/lib/day-trader/exit-planner";
import {
  buildPool,
  historyOrbReplay,
  runMonteCarlo,
  splitUtcSessions,
  CRYPTO_SESSION_BARS,
} from "@/lib/day-trader/time-machine";
import { sizePosition, DEFAULT_BUDGET } from "@/lib/day-trader/budget";
import { checkTicket } from "@/lib/day-trader/risk";
import { getBuilderConfig } from "@/lib/sodex-builder";
import { fetchDailyCloses, fetchKlinesPaged } from "@/lib/day-trader/klines";
import { validateAdvisorSuggestion } from "@/lib/advisor-suggestions";

const WATCH = ["vBTC_vUSDC", "vETH_vUSDC"] as const;

export type WorkflowTicket = {
  mode: "paper";
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  entry: number;
  stop: number;
  target: number;
  notionalUsd: number;
  builderFeeLabel: string;
  requiresExplicitYes: true;
  neverAutoSubmit: true;
};

export type DayTraderWorkflowResult = {
  attribution: string;
  scannedAt: string;
  scan: Array<{
    symbol: string;
    setups: SetupTag[];
    labels: string[];
    price: number;
    rsi: number | null;
    gateway: string;
  }>;
  news: {
    gatewayNote: string;
    tagged: Array<{
      title: string;
      url: string;
      assets: string[];
      tags: string[];
      isShock: boolean;
    }>;
  };
  focus: {
    symbol: string;
    entry: ReturnType<typeof checkEntry>;
    plan: ReturnType<typeof planExit> | null;
    timeMachine: ReturnType<typeof runMonteCarlo> | null;
    history: ReturnType<typeof historyOrbReplay> | null;
    size: ReturnType<typeof sizePosition> | null;
    risk: ReturnType<typeof checkTicket> | null;
    ticket: WorkflowTicket | null;
  };
  steps: string[];
  errors: string[];
};

export async function runDayTraderWorkflow(opts?: {
  symbol?: string;
  budgetUsd?: number;
  maxLossUsd?: number;
  orBars?: number;
  targetR?: number;
  replays?: number;
  seed?: number;
}): Promise<DayTraderWorkflowResult> {
  const errors: string[] = [];
  const steps: string[] = [];
  const orBars = opts?.orBars ?? 12;
  const targetR = opts?.targetR ?? 1;
  const builder = getBuilderConfig();

  // 1) Chart Scanner
  steps.push("scan");
  const scan = [];
  for (const symbol of WATCH) {
    try {
      const { closes, gateway } = await fetchDailyCloses(symbol);
      const found = findDailySetups(closes);
      scan.push({
        symbol,
        setups: found.setups,
        labels: found.setups.map((s) => SETUP_LABELS[s]),
        price: closes[closes.length - 1] ?? 0,
        rsi: found.nums.rsi != null ? Math.round(found.nums.rsi * 10) / 10 : null,
        gateway,
      });
    } catch (e) {
      errors.push(`scan ${symbol}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2) News Monitor (SoSoValue)
  steps.push("news");
  const newsPanel = await fetchHotNews();
  const taggedAll = tagNewsForAssets(newsPanel.items, [...WATCH]);
  const newsView = taggedAll
    .filter((t) => t.relevant)
    .slice(0, 12)
    .map((t) => ({
      title: t.item.title,
      url: t.item.url,
      assets: t.assets,
      tags: t.tags,
      isShock: t.item.isShock,
    }));

  // Focus symbol: prefer requested, else first scan hit, else BTC
  const focusSymbol =
    opts?.symbol && WATCH.includes(opts.symbol as (typeof WATCH)[number])
      ? opts.symbol
      : scan.find((s) => s.setups.length)?.symbol ?? "vBTC_vUSDC";

  const focusNews = newsForSymbol(taggedAll, focusSymbol);

  // 3–5) Entry + Exit + Time Machine on 5m bars
  steps.push("entry", "exit", "timemachine");
  let entry = checkEntry({ bars: [], setup: "orb", orBars });
  let plan: ReturnType<typeof planExit> | null = null;
  let tm: ReturnType<typeof runMonteCarlo> | null = null;
  let history: ReturnType<typeof historyOrbReplay> | null = null;
  let size: ReturnType<typeof sizePosition> | null = null;
  let risk: ReturnType<typeof checkTicket> | null = null;
  let ticket: WorkflowTicket | null = null;

  try {
    const { bars, gateway } = await fetchKlinesPaged({
      symbol: focusSymbol,
      interval: "5m",
      maxBars: 8000,
    });
    if (!bars.length) {
      errors.push(`No 5m SoDEX bars for ${focusSymbol} (${gateway})`);
    } else {
      // Use today's UTC bars for entry; full history for TM
      const today = new Date().toISOString().slice(0, 10);
      const todayBars = bars.filter((b) =>
        new Date(b.t).toISOString().startsWith(today),
      );
      const sessionBars = todayBars.length >= orBars + 2 ? todayBars : bars.slice(-Math.min(CRYPTO_SESSION_BARS, bars.length));
      entry = checkEntry({
        bars: sessionBars,
        setup: "orb",
        orBars,
        preferSide: "both",
      });

      // Build a workable plan even while waiting (use last close as hypothetical entry for TM preview)
      const hypEntry =
        entry.entryPrice ??
        sessionBars[sessionBars.length - 1]?.c ??
        scan.find((s) => s.symbol === focusSymbol)?.price ??
        0;
      const rangeHigh =
        entry.rangeHigh ??
        Math.max(...sessionBars.slice(0, orBars).map((b) => b.h));
      const rangeLow =
        entry.rangeLow ??
        Math.min(...sessionBars.slice(0, orBars).map((b) => b.l));
      const side = entry.side ?? "buy";

      if (hypEntry > 0 && rangeHigh > rangeLow) {
        plan = planExit({
          side,
          entry: hypEntry,
          rangeHigh,
          rangeLow,
          stopRule: "or-mid",
          targetR,
        });

        const sessions = splitUtcSessions(bars).slice(0, -1); // exclude incomplete today
        if (sessions.length >= 5) {
          const pool = buildPool(sessions);
          const entryBar =
            entry.entryBarIndex ??
            Math.min(
              Math.max(orBars, Math.floor(sessionBars.length * 0.4)),
              pool.length - 3,
            );
          const lastBar = Math.min(
            pool.length - 1,
            Math.max(entryBar + 1, Math.floor(pool.length * 0.95)),
          );
          tm = runMonteCarlo({
            pool,
            entry: plan.entry,
            stop: plan.stop,
            target: plan.target,
            entryBarIndex: entryBar,
            lastBarIndex: lastBar,
            side: plan.side,
            replays: opts?.replays ?? 10_000,
            seed: opts?.seed ?? 19,
          });
          history = historyOrbReplay({
            sessions,
            orBars,
            targetR,
            stopRule: "or-mid",
            side: plan.side,
            lastBarIndex: lastBar,
          });
        } else {
          errors.push(
            `Time Machine needs ≥5 full UTC sessions of 5m bars; got ${sessions.length}. Showing plan without Monte Carlo.`,
          );
        }

        // 6–7) Budget + Risk
        steps.push("budget", "risk");
        const maxNotional = builder.maxNotionalUsdc;
        try {
          size = sizePosition({
            entry: plan.entry,
            stop: plan.stop,
            target: plan.target,
            side: plan.side,
            config: {
              budgetUsd: opts?.budgetUsd ?? DEFAULT_BUDGET.budgetUsd,
              maxLossPerTradeUsd: opts?.maxLossUsd ?? DEFAULT_BUDGET.maxLossPerTradeUsd,
              maxOrderUsd: maxNotional,
            },
          });
          // Cap qty to FlowSentinel notional
          if (size.notionalUsd > maxNotional) {
            size = {
              ...size,
              qty: Math.floor((maxNotional / plan.entry) * 1e6) / 1e6,
              notionalUsd: maxNotional,
              limitingFactor: "flowsentinel_notional_cap",
            };
          }
          risk = checkTicket(
            {
              symbol: focusSymbol,
              side: plan.side,
              qty: size.qty,
              entry: plan.entry,
              stop: plan.stop,
              target: plan.target,
              notionalUsd: size.notionalUsd,
            },
            { maxNotionalUsd: maxNotional },
          );

          // 8) Order ticket prefill only
          steps.push("ticket");
          const suggestion = validateAdvisorSuggestion({
            side: plan.side === "buy" ? "LONG" : "SHORT",
            symbol: focusSymbol,
            entry: plan.entry,
            stopLoss: plan.stop,
            takeProfit: plan.target,
            confidence: risk.status === "PASS" ? 65 : 40,
            reasoning: `Day-trader workflow ${entry.status}; TM: ${tm?.verdict ?? "n/a"}`,
          });
          if (suggestion.ok && risk.status === "PASS") {
            ticket = {
              mode: "paper",
              symbol: focusSymbol,
              side: plan.side,
              qty: size.qty,
              entry: plan.entry,
              stop: plan.stop,
              target: plan.target,
              notionalUsd: size.notionalUsd,
              builderFeeLabel: builder.feeLabel,
              requiresExplicitYes: true,
              neverAutoSubmit: true,
            };
          } else if (!suggestion.ok) {
            errors.push(`ticket validation: ${suggestion.error}`);
          }
        } catch (e) {
          errors.push(`budget/risk: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  } catch (e) {
    errors.push(`intraday: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    attribution:
      "Chart/news/entry/exit/Time Machine/risk/budget/ticket adapted from https://github.com/jakeschincariol/day-trader-skill (MIT © 2026 Jake Schincariol). Pelosi & earnings analyst skills skipped. SoDEX public bars + SoSoValue news.",
    scannedAt: new Date().toISOString(),
    scan,
    news: {
      gatewayNote: `SoSoValue news (${newsPanel.meta.source})${focusNews.length ? `; ${focusNews.length} items related to ${formatPair(focusSymbol)}` : ""}`,
      tagged: newsView,
    },
    focus: {
      symbol: focusSymbol,
      entry,
      plan,
      timeMachine: tm,
      history,
      size,
      risk,
      ticket,
    },
    steps,
    errors,
  };
}
