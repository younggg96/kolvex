"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCopy } from "@/components/decision/shared";
import SuperinvestorsDirectory from "./SuperinvestorsDirectory";

export default function SuperinvestorsPage() {
  const c = useCopy();
  return (
    <DashboardLayout title={c("Superinvestors", "超级投资者")}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-[16px] pb-10 pt-4 md:px-8 md:py-8">
          <header className="mb-6 md:mb-8">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem]">{c("Superinvestors", "超级投资者")}</h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              {c(
                "What well-known investors held at the end of their latest reported quarter, from SEC 13F filings.",
                "根据 SEC 13F 申报，查看知名投资者在最近一个申报季度末的持仓。",
              )}
            </p>
          </header>
          <SuperinvestorsDirectory />
        </div>
      </div>
    </DashboardLayout>
  );
}
