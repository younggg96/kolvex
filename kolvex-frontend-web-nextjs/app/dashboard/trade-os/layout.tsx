"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { InfoTip } from "@/components/ui/info-tip";
import { useCopy } from "@/components/decision/shared";
import { cn } from "@/lib/utils";

const BASE = "/dashboard/trade-os";

type Stage = {
  value: string;
  label: string;
  /** Pages inside this stage, in the order a trader uses them. */
  pages: { href: string; label: string }[];
};

export default function TradeOsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const c = useCopy();

  // The nine pages are grouped by where they sit in a trade's life:
  // prepare -> before entry -> holding -> after exit.
  const stages: Stage[] = [
    { value: "overview", label: c("Overview", "总览"), pages: [] },
    {
      value: "prepare",
      label: c("1 · Prepare", "1 准备"),
      pages: [
        { href: `${BASE}/settings`, label: c("Account & Import", "账户与导入") },
        { href: `${BASE}/strategies`, label: c("Strategy Lab", "策略实验室") },
      ],
    },
    {
      value: "entry",
      label: c("2 · Before Entry", "2 开仓前"),
      pages: [
        { href: `${BASE}/market`, label: c("Market Regime", "市场状态") },
        { href: `${BASE}/scanner`, label: c("Scanner", "机会扫描") },
        { href: `${BASE}/plans`, label: c("Trade Plans", "交易计划") },
      ],
    },
    {
      value: "hold",
      label: c("3 · Holding", "3 持仓中"),
      pages: [{ href: `${BASE}/risk`, label: c("Portfolio Risk", "持仓风控") }],
    },
    {
      value: "review",
      label: c("4 · Review", "4 复盘"),
      pages: [
        { href: `${BASE}/journal`, label: c("Journal", "交易复盘") },
        { href: `${BASE}/analytics`, label: c("Analytics", "绩效统计") },
      ],
    },
  ];

  const activeStage =
    stages.find((s) =>
      s.pages.some((p) => pathname === p.href || pathname.startsWith(`${p.href}/`)),
    ) ?? stages[0];

  const stageOptions = stages.map((s) => ({ value: s.value, label: s.label }));

  return (
    <DashboardLayout title={c("Trade OS", "交易系统")}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-5 px-[16px] pb-14 pt-4 md:px-8 md:pt-6">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Trade OS
            </h1>
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500 tracking-wide">
              Beta
            </span>
            <InfoTip label={c("About Trade OS Beta", "关于 Trade OS 实验版")}>
              <p>
                {c(
                  "Trade OS turns every trade into: market check → plan with a stop → risk approval → review. It does not place broker orders; you trade at your broker and import fills afterwards.",
                  "Trade OS 把每笔交易变成：看市场 → 定计划和止损 → 风控审批 → 复盘。它不会替你下单；你在券商下单，之后导入成交流水即可。",
                )}
              </p>
            </InfoTip>
          </div>

          <SegmentedControl
            semantics="nav"
            label={c("Trade OS stages", "Trade OS 阶段")}
            value={activeStage.value}
            onChange={(value) => {
              const stage = stages.find((s) => s.value === value);
              router.push(stage?.pages[0]?.href ?? BASE);
            }}
            options={stageOptions}
            size="md"
            className="max-w-full"
          />

          {activeStage.pages.length > 1 && (
            <nav
              aria-label={c("Pages in this stage", "本阶段页面")}
              className="flex flex-wrap items-center gap-2"
            >
              {activeStage.pages.map((p) => {
                const active = pathname === p.href || pathname.startsWith(`${p.href}/`);
                return (
                  <Link
                    key={p.href}
                    href={p.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-foreground/30 bg-foreground/10 text-foreground"
                        : "border-foreground/10 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="pt-1">{children}</div>
        </div>
      </main>
    </DashboardLayout>
  );
}
