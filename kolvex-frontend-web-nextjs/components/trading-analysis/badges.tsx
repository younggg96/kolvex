import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function DecisionBadge({
  decision,
  t,
}: {
  decision: string | null | undefined;
  t: (key: string) => string;
}) {
  if (!decision) return null;
  const d = decision.toUpperCase();
  const config =
    d === "BUY"
      ? {
          icon: TrendingUp,
          label: t("tradingAnalysis.decision.buy"),
          cls: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
        }
      : d === "SELL"
        ? {
            icon: TrendingDown,
            label: t("tradingAnalysis.decision.sell"),
            cls: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
          }
        : {
            icon: Minus,
            label: t("tradingAnalysis.decision.hold"),
            cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400",
          };
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold",
        config.cls
      )}
    >
      <Icon className="w-3 h-3" /> {config.label}
    </span>
  );
}

export function DecisionBadgeLarge({
  decision,
  t,
}: {
  decision: string | null | undefined;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  if (!decision) return null;
  const d = decision.toUpperCase();
  const config =
    d === "BUY"
      ? {
          icon: TrendingUp,
          label: t("tradingAnalysis.decision.buy"),
          bg: "bg-primary/10 dark:bg-primary/20",
          border: "border-primary/30 dark:border-primary/40",
          text: "text-primary dark:text-primary",
          iconColor: "text-primary dark:text-primary",
        }
      : d === "SELL"
      ? {
          icon: TrendingDown,
          label: t("tradingAnalysis.decision.sell"),
          bg: "bg-red-100 dark:bg-red-500/20",
          border: "border-red-300 dark:border-red-500/40",
          text: "text-red-800 dark:text-red-400",
          iconColor: "text-red-600 dark:text-red-400",
        }
      : {
          icon: Minus,
          label: t("tradingAnalysis.decision.hold"),
          bg: "bg-amber-100 dark:bg-amber-500/20",
          border: "border-amber-300 dark:border-amber-500/40",
          text: "text-amber-800 dark:text-amber-400",
          iconColor: "text-amber-600 dark:text-amber-400",
        };

  const Icon = config.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-5 py-3 rounded-xl border transition-transform hover:scale-105",
        config.bg,
        config.border
      )}
    >
      <Icon className={cn("w-6 h-6", config.iconColor)} />
      <span className={cn("text-2xl font-bold", config.text)}>
        {config.label}
      </span>
    </div>
  );
}

export function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string) => string;
}) {
  const map: Record<string, { cls: string; labelKey: string }> = {
    running: {
      cls: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
      labelKey: "tradingAnalysis.statusRunning",
    },
    completed: {
      cls: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
      labelKey: "tradingAnalysis.statusCompleted",
    },
    failed: {
      cls: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
      labelKey: "tradingAnalysis.statusFailed",
    },
    pending: {
      cls: "bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400",
      labelKey: "tradingAnalysis.statusPending",
    },
  };
  const info = map[status] || map.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        info.cls
      )}
    >
      {status === "running" && (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      )}
      {t(info.labelKey)}
    </span>
  );
}
