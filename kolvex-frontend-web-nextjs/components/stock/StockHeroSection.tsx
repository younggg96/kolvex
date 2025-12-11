"use client";

import { TrendingUp, BarChart3, Bell } from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";

const stockFeatures = [
  {
    icon: TrendingUp,
    label: "Track Market Trends",
    iconClassName: "w-3.5 h-3.5 text-green-600 dark:text-green-400",
  },
];

export function StockHeroSection() {
  return (
    <HeroSection
      title="Stocks"
      description="Track trending stocks and manage your watchlist"
      features={stockFeatures}
    />
  );
}
