"use client";

import { usePathname, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { InfoTip } from "@/components/ui/info-tip";
import { useCopy } from "@/components/decision/shared";

export default function TradeOsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const c = useCopy();

  const navOptions = [
    { value: "/dashboard/trade-os", label: c("Overview", "总览") },
    { value: "/dashboard/trade-os/plans", label: c("Trade Plans", "交易计划") },
    { value: "/dashboard/trade-os/risk", label: c("Portfolio Risk", "持仓风控") },
    { value: "/dashboard/trade-os/market", label: c("Market Regime", "市场状态") },
    { value: "/dashboard/trade-os/scanner", label: c("Scanner", "机会扫描") },
    { value: "/dashboard/trade-os/strategies", label: c("Strategy Lab", "策略实验室") },
    { value: "/dashboard/trade-os/journal", label: c("Journal", "交易复盘") },
    { value: "/dashboard/trade-os/analytics", label: c("Analytics", "绩效统计") },
    { value: "/dashboard/trade-os/settings", label: c("Settings & Import", "设置与导入") },
  ];

  // Determine active route value
  const activeValue =
    navOptions.find((opt) =>
      opt.value === "/dashboard/trade-os"
        ? pathname === "/dashboard/trade-os"
        : pathname === opt.value || pathname.startsWith(`${opt.value}/`),
    )?.value || "/dashboard/trade-os";

  return (
    <DashboardLayout title={c("Trade OS", "交易系统")}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-[16px] pb-14 pt-4 md:px-8 md:pt-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {c("Trade OS", "Trade OS")}
              </h1>
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500 tracking-wide">
                Beta
              </span>
              <InfoTip label={c("About Trade OS Beta", "关于 Trade OS 实验版")}>
                <p>
                  {c(
                    "Kolvex Trade OS is an experimental personal trading decision & risk management system (PRD V1.0). It enforces deterministic rules, position sizing, and journal review without automated broker execution.",
                    "Kolvex Trade OS 为实验性交易决策与风控系统（PRD V1.0）。系统遵循规则优先与限额预算，不代为执行券商自动下单，用于辅助交易纪律与复盘验证。",
                  )}
                </p>
              </InfoTip>
            </div>
          </div>

          {/* Sub Navigation via SegmentedControl */}
          <div className="w-full">
            <SegmentedControl
              semantics="nav"
              label={c("Trade OS Navigation", "Trade OS 导航")}
              value={activeValue}
              onChange={(value) => router.push(value)}
              options={navOptions}
              size="md"
              className="max-w-full"
            />
          </div>

          {/* Page Content */}
          <div className="pt-1">{children}</div>
        </div>
      </main>
    </DashboardLayout>
  );
}
