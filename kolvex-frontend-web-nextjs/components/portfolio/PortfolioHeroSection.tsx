"use client";

import { Shield, TrendingUp, Share2 } from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";
import {
  PortfolioHeaderActions,
  PortfolioHeaderActionsProps,
} from "./PortfolioHeaderActions";

interface PortfolioHeroSectionProps {
  headerActionsProps?: PortfolioHeaderActionsProps;
  className?: string;
}

const portfolioFeatures = [
  {
    icon: Shield,
    label: "Secure Connection",
    iconClassName: "w-3.5 h-3.5 text-green-600 dark:text-green-400",
  },
  {
    icon: TrendingUp,
    label: "Real-time Tracking",
    iconClassName: "w-3.5 h-3.5 text-primary",
  },
  {
    icon: Share2,
    label: "Optional Sharing",
    iconClassName: "w-3.5 h-3.5 text-blue-600 dark:text-blue-400",
  },
];

export function PortfolioHeroSection({
  headerActionsProps,
  className,
}: PortfolioHeroSectionProps) {
  return (
    <HeroSection
      className={className}
      title="My Holdings"
      description="Track and share your investment holdings"
      actions={
        headerActionsProps ? (
          <PortfolioHeaderActions {...headerActionsProps} />
        ) : undefined
      }
      features={portfolioFeatures}
    />
  );
}
