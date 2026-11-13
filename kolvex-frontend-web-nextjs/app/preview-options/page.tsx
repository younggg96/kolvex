"use client";

import * as React from "react";
import { ContributionBoard, MarketOverview, TickerLevels, UnusualContracts } from "@/components/options-activity/sections";
import type { ActivityRun } from "@/lib/optionsActivity";
import { ScannedSymbols } from "@/components/admin/OptionsActivityManager";

const contract = (overrides: Partial<ActivityRun["payload"]["contracts"][number]>) => ({
  symbol: "SPY260120P00725000", underlying: "SPY", is_etf: true, type: "put" as const, strike: 725,
  expiration: "2026-11-20", dte: 13, premium: 146_500_000, volume: 19_600, open_interest: 10_900,
  vol_oi: 1.8, price: 7.37, last: 7.4, iv: 0.32, delta: -0.31, otm_pct: -1.2,
  flags: { new_positions: true, crosses_earnings: false }, ...overrides,
});

const ticker = (symbol: string, sources: ActivityRun["payload"]["tickers"][number]["sources"]) => ({
  symbol, sources, is_etf: false, spot: 100, change_pct: 1.2, call_premium: 2e6, put_premium: 1e6, net_premium: 1e6,
  pc_premium_ratio: 0.5, pc_baseline: 0.6, implied_range: null, max_pain: null, gamma_level: null, earnings_date: null,
});

const run: ActivityRun = {
  id: "preview", trade_date: "2026-11-09", session: "pre", run_at: "2026-11-09T13:30:00Z",
  data_date: null, universe_size: 20, failed_symbols: [], summary: null, day_runs: [],
  payload: {
    market: { call_premium: 1, put_premium: 2, net_premium: -1, pc_premium_ratio: 1.2, pc_baseline: 1, baseline_runs: 10, etf_net_premium: -1, stock_net_premium: 0, tickers_scanned: 20, dynamic_scanned: 3 },
    contributors: {
      positive: [
        { symbol: "NBIS", is_etf: false, net_premium: 84_000_000, sources: ["mover", "active", "kol"] },
        { symbol: "AMD", is_etf: false, net_premium: 61_000_000, sources: ["core", "mover"] },
      ],
      negative: [{ symbol: "QQQ", is_etf: true, net_premium: -120_000_000, sources: ["core"] }],
      positive_total: 145_000_000, negative_total: -120_000_000,
    },
    contracts: [
      contract({}),
      contract({ symbol: "SPY2", strike: 740, premium: 115_500_000, vol_oi: 0.8, price: 12.04 }),
      contract({ symbol: "QQQ1", underlying: "QQQ", type: "call", strike: 730, premium: 109_700_000, vol_oi: 5.1, price: 71.47 }),
      contract({ symbol: "SPY3", strike: 710, premium: 56_100_000, vol_oi: 5.1, price: 4.62 }),
      contract({ symbol: "NBIS1", underlying: "NBIS", is_etf: false, type: "call", strike: 120, premium: 41_000_000, vol_oi: 6.2, price: 3.1 }),
    ],
    tickers: [
      ticker("QQQ", ["core"]),
      ticker("NBIS", ["mover", "active", "kol"]),
      ticker("SPY", ["core", "kol"]),
    ],
  },
};

function ViewportProbe() {
  const [text, setText] = React.useState("measuring");
  React.useEffect(() => {
    const table = document.querySelector("table");
    const card = table?.parentElement;
    setText(`vw${window.innerWidth} table${Math.round(table?.getBoundingClientRect().width ?? 0)} card${Math.round(card?.getBoundingClientRect().width ?? 0)}`);
  }, []);
  return <p data-probe="viewport" className="text-xs text-muted-foreground dark:text-white">{text}</p>;
}

export default function PreviewOptionsPage() {
  return <main className="mx-auto max-w-4xl p-8"><ViewportProbe /><div className="space-y-8"><ScannedSymbols run={{
  id: "preview", trade_date: "2026-11-12", session: "post", run_at: "2026-11-12T21:20:00Z", candidates: null,
  universe: { SPY: ["core", "kol"], QQQ: ["core"], NVDA: ["core", "active", "kol"], AMD: ["core", "mover"], MOD: ["mover"], NBIS: ["mover", "active", "kol"], PAAS: ["active"], TSM: ["kol"], ANT: ["kol"] },
  skipped_symbols: ["ANT"], failed_symbols: [],
}} /><MarketOverview run={run} /><ContributionBoard run={run} /><UnusualContracts run={run} /><TickerLevels run={run} /></div></main>;
}
