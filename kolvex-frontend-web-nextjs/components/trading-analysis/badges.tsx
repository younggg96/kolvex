import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function decisionConfig(decision: string, t: (key: string) => string) {
  const d = decision.toUpperCase();
  if (d === "BUY") {
    return {
      icon: TrendingUp,
      label: t("tradingAnalysis.decision.buy"),
      text: "text-positive",
      fill: "bg-positive/10",
    };
  }
  if (d === "SELL") {
    return {
      icon: TrendingDown,
      label: t("tradingAnalysis.decision.sell"),
      text: "text-negative",
      fill: "bg-negative/10",
    };
  }
  return {
    icon: Minus,
    label: t("tradingAnalysis.decision.hold"),
    text: "text-foreground",
    fill: "bg-muted",
  };
}

export function DecisionBadge({
  decision,
  t,
}: {
  decision: string | null | undefined;
  t: (key: string) => string;
}) {
  if (!decision) return null;
  const config = decisionConfig(decision, t);
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        config.fill,
        config.text
      )}
    >
      <Icon className="h-3 w-3" /> {config.label}
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
  const config = decisionConfig(decision, t);
  const Icon = config.icon;
  return (
    <div className={cn("flex items-center gap-2", config.text)}>
      <Icon className="h-7 w-7" strokeWidth={2.5} />
      <span className="text-[32px] font-bold leading-none">{config.label}</span>
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
      cls: "bg-foreground/[0.06] text-foreground",
      labelKey: "tradingAnalysis.statusRunning",
    },
    completed: {
      cls: "bg-foreground/[0.06] text-muted-foreground",
      labelKey: "tradingAnalysis.statusCompleted",
    },
    failed: {
      cls: "bg-negative/10 text-negative",
      labelKey: "tradingAnalysis.statusFailed",
    },
    pending: {
      cls: "bg-foreground/[0.06] text-muted-foreground",
      labelKey: "tradingAnalysis.statusPending",
    },
  };
  const info = map[status] || map.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        info.cls
      )}
    >
      {status === "running" && (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      )}
      {t(info.labelKey)}
    </span>
  );
}
