"use client";

import { Users, TrendingUp, Bell } from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";

const kolFeatures = [
  {
    icon: Users,
    label: "Track Top KOLs",
    iconClassName: "w-3.5 h-3.5 text-blue-600 dark:text-blue-400",
  },
  {
    icon: Bell,
    label: "Get Notified",
    iconClassName: "w-3.5 h-3.5 text-orange-600 dark:text-orange-400",
  },
];

export function KOLHeroSection() {
  return (
    <HeroSection
      title="KOL Tracker"
      description="Follow influential market leaders and stay updated on their insights"
      features={kolFeatures}
      className="p-4 border-b border-border-light dark:border-border-dark shadow-sm"
    />
  );
}
