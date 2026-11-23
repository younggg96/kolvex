"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCopy } from "@/components/decision/shared";
import {
  ShieldAlert,
  BarChart3,
  Search,
  FileSpreadsheet,
  PieChart,
  FlaskConical,
  BookOpen,
  LineChart,
  Settings,
} from "lucide-react";

interface SubNavItem {
  href: string;
  labelEn: string;
  labelZh: string;
  icon: any;
  phase: number;
}

const SUB_NAV_ITEMS: SubNavItem[] = [
  { href: "/dashboard/trade-os", labelEn: "Overview", labelZh: "总览", icon: BarChart3, phase: 0 },
  {
    href: "/dashboard/trade-os/settings",
    labelEn: "Settings & Import",
    labelZh: "账户与导入",
    icon: Settings,
    phase: 0,
  },
  {
    href: "/dashboard/trade-os/plans",
    labelEn: "Trade Plans",
    labelZh: "交易计划",
    icon: FileSpreadsheet,
    phase: 1,
  },
  {
    href: "/dashboard/trade-os/risk",
    labelEn: "Portfolio Risk",
    labelZh: "持仓风控",
    icon: PieChart,
    phase: 1,
  },
  {
    href: "/dashboard/trade-os/market",
    labelEn: "Market Regime",
    labelZh: "市场状态",
    icon: ShieldAlert,
    phase: 2,
  },
  {
    href: "/dashboard/trade-os/scanner",
    labelEn: "Scanner",
    labelZh: "机会扫描",
    icon: Search,
    phase: 2,
  },
  {
    href: "/dashboard/trade-os/strategies",
    labelEn: "Strategy Lab",
    labelZh: "策略实验室",
    icon: FlaskConical,
    phase: 1,
  },
  {
    href: "/dashboard/trade-os/journal",
    labelEn: "Journal",
    labelZh: "交易复盘",
    icon: BookOpen,
    phase: 3,
  },
  {
    href: "/dashboard/trade-os/analytics",
    labelEn: "Analytics",
    labelZh: "绩效统计",
    icon: LineChart,
    phase: 3,
  },
];

export default function TradeOsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const c = useCopy();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Subnavigation Bar */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-12 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Kolvex Trade OS
            </span>
            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[0.6875rem] font-semibold text-amber-500 uppercase tracking-wider">
              {c("Experimental · Beta", "实验性功能 · Beta")}
            </span>
          </div>

          {/* Navigation links */}
          <nav className="flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
            {SUB_NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/dashboard/trade-os"
                  ? pathname === "/dashboard/trade-os"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{c(item.labelEn, item.labelZh)}</span>
                  {item.phase > 0 && (
                    <span className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.2 text-[0.625rem] text-xs">
                      P{item.phase}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main page content */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
