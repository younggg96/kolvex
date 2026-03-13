"use client";

import {
  Gem,
  TrendingUp,
  Zap,
  Wallet,
  ArrowDownUp,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Strategy } from "@/lib/stockScreenerApi";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  gem: Gem,
  "trending-up": TrendingUp,
  zap: Zap,
  wallet: Wallet,
  "arrow-down-up": ArrowDownUp,
  award: Award,
};

interface StrategyCardProps {
  strategy: Strategy;
  isSelected: boolean;
  onClick: () => void;
  locale: string;
}

export default function StrategyCard({
  strategy,
  isSelected,
  onClick,
  locale,
}: StrategyCardProps) {
  const Icon = ICON_MAP[strategy.icon] || Gem;
  const isZh = locale === "zh";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-200",
        "hover:border-primary/50 hover:shadow-sm",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
          : "border-border bg-card"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
          isSelected
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold leading-tight text-foreground">
          {isZh ? strategy.name_zh : strategy.name}
        </p>
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground line-clamp-2">
          {isZh ? strategy.description_zh : strategy.description}
        </p>
      </div>
    </button>
  );
}
