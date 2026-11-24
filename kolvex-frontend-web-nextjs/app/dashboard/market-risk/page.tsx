"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { MarketRiskView } from "@/components/market-risk/MarketRiskView";
import { useCopy } from "@/components/decision/shared";

export default function MarketRiskPage() {
  const c = useCopy();
  return (
    <DashboardLayout title={c("Market risk", "市场风险")}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-5 px-[16px] pb-14 pt-4 md:px-8 md:pt-6">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {c("Market risk", "市场风险")}
            </h1>
            <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-warning">
              Beta
            </span>
          </div>
          <MarketRiskView />
        </div>
      </main>
    </DashboardLayout>
  );
}
