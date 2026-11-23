"use client";

import { useEffect, useState, useCallback } from "react";
import { useCopy } from "@/components/decision/shared";
import {
  TradingAccount,
  PortfolioRiskSummary,
  RiskConfig,
  AccountRiskState,
  fetchAccounts,
  fetchPortfolioRisk,
  fetchRiskConfig,
  fetchRiskState,
  fetchDrawdown,
} from "@/lib/tradeOsApi";
import { PortfolioRiskDashboard } from "@/components/trade-os/risk/PortfolioRiskDashboard";

export default function TradeOsRiskPage() {
  const c = useCopy();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PortfolioRiskSummary | null>(null);
  const [riskConfig, setRiskConfig] = useState<RiskConfig | null>(null);
  const [riskState, setRiskState] = useState<AccountRiskState | null>(null);
  const [drawdownPct, setDrawdownPct] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadInitialData = useCallback(async () => {
    try {
      const accs = await fetchAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  const loadRiskData = useCallback(async (accId: string) => {
    try {
      const [sum, conf, st, dd] = await Promise.all([
        fetchPortfolioRisk(accId),
        fetchRiskConfig(accId),
        fetchRiskState(accId),
        fetchDrawdown(accId).catch(() => ({ current_drawdown_pct: "0.0" })),
      ]);
      setSummary(sum);
      setRiskConfig(conf);
      setRiskState(st);
      setDrawdownPct(parseFloat(dd.current_drawdown_pct || "0"));
    } catch (err) {
      console.error("Failed to load portfolio risk data", err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedAccountId) {
      loadRiskData(selectedAccountId);
    }
  }, [selectedAccountId, loadRiskData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {c("Portfolio Risk & Drawdown Monitor", "组合风险与回撤监控")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {c(
              "Track open risk to stops, capital concentration, and cash-flow-adjusted account drawdowns.",
              "实时监控有效止损敞口、多头名义本金集中度以及出入金调整后的真实账户回撤。",
            )}
          </p>
        </div>

        {accounts.length > 0 && (
          <select
            value={selectedAccountId || ""}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_name} ({a.broker})
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground">
          {c("Loading portfolio risk metrics...", "正在加载组合风控指标...")}
        </div>
      ) : (
        <PortfolioRiskDashboard
          summary={summary}
          riskConfig={riskConfig}
          riskState={riskState}
          drawdownPct={drawdownPct}
        />
      )}
    </div>
  );
}
