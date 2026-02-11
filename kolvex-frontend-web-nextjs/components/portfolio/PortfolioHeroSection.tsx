"use client";

import { Shield, TrendingUp, Share2 } from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";
import {
  PortfolioHeaderActions,
  PortfolioHeaderActionsProps,
} from "./PortfolioHeaderActions";
import { useTranslation } from "@/lib/i18n";

interface PortfolioHeroSectionProps {
  headerActionsProps?: PortfolioHeaderActionsProps;
  className?: string;
}

export function PortfolioHeroSection({
  headerActionsProps,
  className,
}: PortfolioHeroSectionProps) {
  const { t } = useTranslation();

  const portfolioFeatures = [
    {
      icon: Shield,
      label: t("portfolio.hero.secureConnection"),
      iconClassName: "w-3.5 h-3.5 text-green-600 dark:text-green-400",
    },
    {
      icon: TrendingUp,
      label: t("portfolio.hero.realTimeTracking"),
      iconClassName: "w-3.5 h-3.5 text-primary",
    },
    {
      icon: Share2,
      label: t("portfolio.hero.optionalSharing"),
      iconClassName: "w-3.5 h-3.5 text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <HeroSection
      className={className}
      title={t("portfolio.hero.title")}
      description={t("portfolio.hero.description")}
      actions={
        headerActionsProps ? (
          <PortfolioHeaderActions {...headerActionsProps} />
        ) : undefined
      }
      features={portfolioFeatures}
    />
  );
}
