"use client";

import { TrendingUp, BarChart3, Bell } from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";
import { cn } from "@/lib/utils";

const stockFeatures = [
  {
    icon: TrendingUp,
    label: "Track Market Trends",
    iconClassName: "w-3.5 h-3.5 text-green-600 dark:text-green-400",
  },
];

export function StockHeroSection({ className }: { className?: string }) {
  return (
    <HeroSection
      title="Stocks"
      description="Track trending stocks and manage your watchlist"
      features={stockFeatures}
      className={cn(
        "p-4 border-b border-border-light dark:border-0 shadow-sm",
        className
      )}
    />
  );
}
