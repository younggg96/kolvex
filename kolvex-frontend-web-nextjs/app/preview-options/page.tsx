"use client";

import * as React from "react";
import { UnusualContracts } from "@/components/options-activity/sections";
import type { ActivityRun } from "@/lib/optionsActivity";

const contract = (overrides: Partial<ActivityRun["payload"]["contracts"][number]>) => ({
  symbol: "SPY260120P00725000", underlying: "SPY", is_etf: true, type: "put" as const, strike: 725,
  expiration: "2026-11-20", dte: 13, premium: 146_500_000, volume: 19_600, open_interest: 10_900,
  vol_oi: 1.8, price: 7.37, last: 7.4, iv: 0.32, delta: -0.31, otm_pct: -1.2,
  flags: { new_positions: true, crosses_earnings: false }, ...overrides,
});

const run: ActivityRun = {
  id: "preview", trade_date: "2026-11-09", session: "pre", run_at: "2026-11-09T13:30:00Z",
  data_date: null, universe_size: 20, failed_symbols: [], summary: null, day_runs: [],
  payload: {
    market: { call_premium: 1, put_premium: 2, net_premium: -1, pc_premium_ratio: 1.2, pc_baseline: 1, baseline_runs: 10, etf_net_premium: -1, stock_net_premium: 0, tickers_scanned: 20 },
    contributors: { positive: [], negative: [], positive_total: 0, negative_total: 0 },
    contracts: [
      contract({}),
      contract({ symbol: "SPY2", strike: 740, premium: 115_500_000, vol_oi: 0.8, price: 12.04 }),
      contract({ symbol: "QQQ1", underlying: "QQQ", type: "call", strike: 730, premium: 109_700_000, vol_oi: 5.1, price: 71.47 }),
      contract({ symbol: "SPY3", strike: 710, premium: 56_100_000, vol_oi: 5.1, price: 4.62 }),
    ],
    tickers: [],
  },
};

function ViewportProbe() {
  const [text, setText] = React.useState("measuring");
  React.useEffect(() => {
    const table = document.querySelector("table");
    const card = table?.parentElement;
    setText(`vw${window.innerWidth} table${Math.round(table?.getBoundingClientRect().width ?? 0)} card${Math.round(card?.getBoundingClientRect().width ?? 0)}`);
  }, []);
  return <p data-probe="viewport" className="text-xs text-white">{text}</p>;
}

export default function PreviewOptionsPage() {
  return <main className="mx-auto max-w-4xl p-8"><ViewportProbe /><UnusualContracts run={run} /></main>;
}
