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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      {/* Account Toolbar */}
      {accounts.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {c("Trading Account", "交易账户")}:
            </span>
            <Select
              value={selectedAccountId || ""}
              onValueChange={(val) => setSelectedAccountId(val)}
            >
              <SelectTrigger className="h-9 w-[220px] rounded-full text-xs font-medium">
                <SelectValue placeholder={c("Select account", "选择账户")} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs font-medium">
                    {a.account_name} ({a.broker})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-foreground/10 bg-card-glass p-12 text-center text-xs text-muted-foreground">
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
