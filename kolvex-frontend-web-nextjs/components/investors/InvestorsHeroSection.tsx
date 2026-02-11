"use client";

import { RefreshCw } from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface InvestorsHeroSectionProps {
  className?: string;
  syncing?: boolean;
  onSync?: () => void;
}

export function InvestorsHeroSection({
  className,
  syncing = false,
  onSync,
}: InvestorsHeroSectionProps) {
  const { t } = useTranslation();

  return (
    <HeroSection
      className={className}
      title={t("investors.hero.title")}
      description={t("investors.hero.description")}
      actions={
        onSync && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={syncing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? t("investors.syncing") : t("investors.hero.syncData")}
          </Button>
        )
      }
    />
  );
}
