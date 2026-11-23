"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  RiskAssessment,
  StrategyVersion,
  TradePlan,
  fetchPlans,
  fetchStrategies,
} from "@/lib/tradeOsApi";
import { TradePlanBuilder } from "@/components/trade-os/plans/TradePlanBuilder";
import { PlanList } from "@/components/trade-os/plans/PlanList";
import { ApprovalModal } from "@/components/trade-os/plans/ApprovalModal";
import { JournalView } from "@/components/trade-os/journal/JournalView";
import { AnalyticsView } from "@/components/trade-os/analytics/AnalyticsView";
import { AccountPicker, useTradeAccount } from "@/components/trade-os/AccountPicker";
import { Plus, UploadCloud, X } from "lucide-react";

type Tab = "plans" | "journal" | "stats";

function TradesContent() {
  const c = useCopy();
  const params = useSearchParams();
  const fromSignal = !!params?.get("symbol");
  const { accounts, accountId, setAccountId } = useTradeAccount();
  const [tab, setTab] = useState<Tab>("plans");
  const [showBuilder, setShowBuilder] = useState(fromSignal);
  const [strategies, setStrategies] = useState<StrategyVersion[]>([]);
  const [plans, setPlans] = useState<TradePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);

  useEffect(() => {
    fetchStrategies()
      .then(setStrategies)
      .catch(() => setStrategies([]));
  }, []);

  const loadPlans = useCallback(async (id: string) => {
    setPlansLoading(true);
    try {
      setPlans(await fetchPlans(id));
    } catch {
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accountId) loadPlans(accountId);
  }, [accountId, loadPlans]);

  const afterChange = (a?: RiskAssessment) => {
    if (accountId) loadPlans(accountId);
    if (a) setAssessment(a);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label={c("Trade views", "交易视图")}
          value={tab}
          onChange={setTab}
          size="sm"
          options={[
            { value: "plans", label: c("Plans", "计划") },
            { value: "journal", label: c("Review", "复盘") },
            { value: "stats", label: c("Stats", "统计") },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <AccountPicker accounts={accounts} accountId={accountId} onChange={setAccountId} />
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-9 gap-1.5 rounded-full px-3 text-xs"
          >
            <Link href="/dashboard/trade-os/settings">
              <UploadCloud className="h-3.5 w-3.5" />
              {c("Import fills", "导入成交")}
            </Link>
          </Button>
          {tab === "plans" && (
            <Button
              size="sm"
              onClick={() => setShowBuilder((v) => !v)}
              className="h-9 gap-1.5 rounded-full px-3.5 text-xs"
            >
              {showBuilder ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showBuilder ? c("Close", "收起") : c("New plan", "新建计划")}
            </Button>
          )}
        </div>
      </div>

      {tab === "plans" && (
        <>
          {showBuilder && (
            <TradePlanBuilder
              accounts={accounts}
              selectedAccountId={accountId}
              strategies={strategies}
              onPlanCreated={afterChange}
            />
          )}
          <PlanList plans={plans} loading={plansLoading} onPlanUpdated={afterChange} />
          <ApprovalModal assessment={assessment} onClose={() => setAssessment(null)} />
        </>
      )}
      {tab === "journal" && <JournalView accountId={accountId} />}
      {tab === "stats" && <AnalyticsView accountId={accountId} />}
    </div>
  );
}

export default function TradeOsTradesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-48 animate-pulse rounded-3xl border border-foreground/10 bg-card-glass" />
      }
    >
      <TradesContent />
    </Suspense>
  );
}
