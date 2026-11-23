"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCopy } from "@/components/decision/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AccountRiskState,
  MarketRegimeResponse,
  PortfolioRiskSummary,
  RiskConfig,
  fetchDrawdown,
  fetchMarketRegime,
  fetchPortfolioRisk,
  fetchRiskConfig,
  fetchRiskState,
} from "@/lib/tradeOsApi";
import { ScannerView } from "@/components/trade-os/scanner/ScannerView";
import { MarketRegimeView } from "@/components/trade-os/market/MarketRegimeView";
import { PortfolioRiskDashboard } from "@/components/trade-os/risk/PortfolioRiskDashboard";
import { AccountPicker, useTradeAccount } from "@/components/trade-os/AccountPicker";
import { RegimeBadge } from "@/components/trade-os/shared";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Risk = {
  summary: PortfolioRiskSummary | null;
  config: RiskConfig | null;
  state: AccountRiskState | null;
  drawdownPct: number | null;
};

export default function TradeOsTodayPage() {
  const c = useCopy();
  const { accounts, accountId, setAccountId, loading: accountsLoading } = useTradeAccount();
  const [regime, setRegime] = useState<MarketRegimeResponse | null>(null);
  const [regimeError, setRegimeError] = useState(false);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [riskError, setRiskError] = useState(false);
  const [showMarket, setShowMarket] = useState(false);

  useEffect(() => {
    fetchMarketRegime()
      .then(setRegime)
      .catch(() => setRegimeError(true));
  }, []);

  useEffect(() => {
    if (!accountId) return;
    setRisk(null);
    setRiskError(false);
    Promise.all([
      fetchPortfolioRisk(accountId),
      fetchRiskConfig(accountId),
      fetchRiskState(accountId),
      // Unknown drawdown stays unknown; it is never shown as 0%.
      fetchDrawdown(accountId)
        .then((dd) => parseFloat(dd.current_drawdown_pct))
        .catch(() => null),
    ])
      .then(([summary, config, state, drawdownPct]) =>
        setRisk({ summary, config, state, drawdownPct }),
      )
      .catch(() => setRiskError(true));
  }, [accountId]);

  const pct = (v?: string) => `${(parseFloat(v || "0") * 100).toFixed(2)}%`;
  const allowed = regime?.allow_new_entries ?? false;
  const frozen =
    !!risk?.state && risk.state.state !== "normal" && risk.state.state !== "reduced_risk";

  let headline: string;
  if (regimeError || !regime) {
    headline = regimeError
      ? c("Market state failed to load — don't open new trades", "市场状态加载失败，先不要开新仓")
      : c("Checking the market...", "正在检查市场...");
  } else if (!allowed) {
    headline = c("No new longs today", "今天不开新多仓");
  } else if (frozen) {
    headline = c("Account is locked — no new trades", "账户风控锁定中，不开新仓");
  } else {
    headline = c("New longs allowed today", "今天可以开新多仓");
  }

  return (
    <div className="space-y-8">
      {/* 1. Can I trade today? */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RegimeBadge regime={regime?.regime} className="px-3 py-1 text-sm" />
          <AccountPicker accounts={accounts} accountId={accountId} onChange={setAccountId} />
        </div>
        <h2
          className={cn(
            "text-xl font-semibold tracking-tight sm:text-2xl",
            regime && allowed && !frozen ? "text-foreground" : "text-negative",
          )}
        >
          {headline}
        </h2>
        {regime && (
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            {[
              [c("Risk per trade", "单笔风险"), allowed ? pct(regime.effective_risk_pct) : "0%"],
              [c("Max positions", "最多持仓"), String(regime.max_positions)],
              [c("Total open risk", "合计止损风险"), pct(regime.max_open_risk_pct)],
              [c("Based on close of", "依据收盘日"), regime.data_as_of ?? "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="figure mt-0.5 text-sm font-semibold text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <button
          type="button"
          onClick={() => setShowMarket((v) => !v)}
          aria-expanded={showMarket}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {c("Why? SPY / QQQ details", "为什么？看 SPY / QQQ 明细")}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", showMarket && "rotate-180")}
          />
        </button>
        {showMarket && (
          <div className="border-t border-border/50 pt-4">
            <MarketRegimeView />
          </div>
        )}
      </Card>

      {/* 2. Which stocks have a signal? */}
      <section>
        <ScannerView embedded />
      </section>

      {/* 3. What am I holding and how much risk? */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          {c("Positions & risk", "持仓与风险")}
        </h2>
        {!accountsLoading && accounts.length === 0 ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm text-foreground">
              {c(
                "Add an account to size trades and track risk.",
                "添加交易账户后才能计算仓位和风险。",
              )}
            </p>
            <Button size="sm" asChild className="rounded-full">
              <Link href="/dashboard/trade-os/settings">{c("Add account", "添加账户")}</Link>
            </Button>
          </Card>
        ) : riskError ? (
          <Card className="p-5 text-sm text-negative">
            {c("Risk data failed to load.", "风险数据加载失败。")}
          </Card>
        ) : !risk ? (
          <div className="h-40 animate-pulse rounded-3xl border border-foreground/10 bg-card-glass" />
        ) : (
          <>
            {risk.drawdownPct == null && (
              <p className="text-xs text-negative">
                {c("Drawdown couldn't be calculated.", "回撤无法计算。")}
              </p>
            )}
            <PortfolioRiskDashboard
              summary={risk.summary}
              riskConfig={risk.config}
              riskState={risk.state}
              drawdownPct={risk.drawdownPct ?? 0}
            />
          </>
        )}
      </section>

      <footer className="pb-2 text-center text-xs text-muted-foreground">
        {c(
          "Trade OS is experimental. It does not place orders; backtests and rules do not promise future returns.",
          "Trade OS 为实验功能，不会替你下单；回测与规则试算不代表未来收益。",
        )}
      </footer>
    </div>
  );
}
