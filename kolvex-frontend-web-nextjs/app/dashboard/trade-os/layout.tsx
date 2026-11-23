"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { InfoTip } from "@/components/ui/info-tip";
import { useCopy } from "@/components/decision/shared";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "/dashboard/trade-os";

export default function TradeOsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const c = useCopy();

  // Three pages for the three questions a trader asks:
  // what can I do today, how are my trades going, does the strategy work.
  const tabs = [
    { value: BASE, label: c("Today", "今天") },
    { value: `${BASE}/trades`, label: c("Trades", "交易") },
    { value: `${BASE}/strategies`, label: c("Strategy", "策略") },
  ];
  const active =
    tabs.find((t) => t.value !== BASE && pathname.startsWith(t.value))?.value ??
    (pathname === BASE ? BASE : null);
  const onSettings = pathname.startsWith(`${BASE}/settings`);

  return (
    <DashboardLayout title={c("Trade OS", "交易系统")}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-5 px-[16px] pb-14 pt-4 md:px-8 md:pt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Trade OS
              </h1>
              <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-warning">
                Beta
              </span>
              <InfoTip label={c("How Trade OS works", "Trade OS 怎么用")}>
                <p>
                  {c(
                    "Today: see if new longs are allowed and which stocks have a signal, then tap Create plan. Trades: the system sizes the position and approves or blocks it; you place the order at your broker, import the fills, and review closed trades. Strategy: check whether the rules have held up in backtests. Trade OS never places orders.",
                    "今天：看能不能开新仓、哪些股票出了信号，点「生成计划」。交易：系统算好股数并给出通过或拒绝；你在券商下单、导入成交，平仓后复盘。策略：用回测看这套规则过去是否有效。Trade OS 不会替你下单。",
                  )}
                </p>
              </InfoTip>
            </div>
            <Link
              href={`${BASE}/settings`}
              aria-label={c("Accounts & import", "账户与导入")}
              title={c("Accounts & import", "账户与导入")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground hover:text-foreground",
                onSettings && "border-foreground/30 text-foreground",
              )}
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>

          <SegmentedControl
            semantics="nav"
            label={c("Trade OS pages", "Trade OS 页面")}
            value={active}
            onChange={(value) => router.push(value)}
            options={tabs}
            size="md"
            className="max-w-full"
          />

          <div className="pt-1">{children}</div>
        </div>
      </main>
    </DashboardLayout>
  );
}
