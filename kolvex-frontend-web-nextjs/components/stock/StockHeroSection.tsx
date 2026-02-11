"use client";

import { TrendingUp } from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

export function StockHeroSection({ className }: { className?: string }) {
  const { t } = useTranslation();

  const stockFeatures = [
    {
      icon: TrendingUp,
      label: t("stocks.hero.trackMarketTrends"),
      iconClassName: "w-3.5 h-3.5 text-green-600 dark:text-green-400",
    },
  ];

  return (
    <HeroSection
      title={t("stocks.hero.title")}
      description={t("stocks.hero.description")}
      features={stockFeatures}
      className={cn(
        "p-4 border-b border-border-light dark:border-0 shadow-sm",
        className
      )}
    />
  );
}
