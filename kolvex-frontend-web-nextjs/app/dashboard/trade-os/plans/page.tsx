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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

      {/* Plan Builder Form */}
      <Suspense
        fallback={
          <div className="h-48 rounded-3xl border border-foreground/10 bg-card-glass animate-pulse" />
        }
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
