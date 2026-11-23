"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useCopy } from "@/components/decision/shared";
import {
  TradingAccount,
  TradePlan,
  StrategyVersion,
  RiskAssessment,
  fetchAccounts,
  fetchPlans,
  fetchStrategies,
} from "@/lib/tradeOsApi";
import { TradePlanBuilder } from "@/components/trade-os/plans/TradePlanBuilder";
import { PlanList } from "@/components/trade-os/plans/PlanList";
import { ApprovalModal } from "@/components/trade-os/plans/ApprovalModal";

export default function TradeOsPlansPage() {
  const c = useCopy();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategyVersion[]>([]);
  const [plans, setPlans] = useState<TradePlan[]>([]);
  const [latestAssessment, setLatestAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInitialData = useCallback(async () => {
    try {
      const [accs, strats] = await Promise.all([fetchAccounts(), fetchStrategies()]);
      setAccounts(accs);
      setStrategies(strats);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
    } catch (err) {
      console.error("Failed to load plans data", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  const loadPlans = useCallback(async (accId: string) => {
    try {
      const planList = await fetchPlans(accId);
      setPlans(planList);
    } catch (err) {
      console.error("Failed to fetch plans", err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedAccountId) {
      loadPlans(selectedAccountId);
    }
  }, [selectedAccountId, loadPlans]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {c("Trade Plans & Pre-Trade Risk Engine", "交易计划与开仓前风控审批")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {c(
              "Every trade requires an approved plan. Server-side risk engine enforces position sizing and risk caps.",
              "每笔交易均需关联有效的交易计划。服务端风控引擎强制校验仓位预算并拦截超标交易。",
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

      {/* Plan Builder Form */}
      <Suspense
        fallback={<div className="h-48 rounded-xl border border-border bg-card/50 animate-pulse" />}
      >
        <TradePlanBuilder
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          strategies={strategies}
          onPlanCreated={(assessment) => {
            if (selectedAccountId) loadPlans(selectedAccountId);
            if (assessment) setLatestAssessment(assessment);
          }}
        />
      </Suspense>

      {/* Plans List Table */}
      <PlanList
        plans={plans}
        loading={loading}
        onPlanUpdated={(assessment) => {
          if (selectedAccountId) loadPlans(selectedAccountId);
          if (assessment) setLatestAssessment(assessment);
        }}
      />

      {/* Assessment Decision Modal */}
      <ApprovalModal assessment={latestAssessment} onClose={() => setLatestAssessment(null)} />
    </div>
  );
}
