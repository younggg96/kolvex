"use client";

import { Users, Bell } from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";
import { useTranslation } from "@/lib/i18n";

export function KOLHeroSection() {
  const { t } = useTranslation();

  const kolFeatures = [
    {
      icon: Users,
      label: t("kol.hero.trackTopKols"),
      iconClassName: "w-3.5 h-3.5 text-blue-600 dark:text-blue-400",
    },
    {
      icon: Bell,
      label: t("kol.hero.getNotified"),
      iconClassName: "w-3.5 h-3.5 text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <HeroSection
      title={t("kol.hero.title")}
      description={t("kol.hero.description")}
      features={kolFeatures}
    />
  );
}
