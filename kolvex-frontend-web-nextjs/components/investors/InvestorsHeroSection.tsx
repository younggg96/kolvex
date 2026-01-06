"use client";

import { RefreshCw } from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";

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
  return (
    <HeroSection
      className={className}
      title="Superinvestors"
      description="Track 13F filings from top institutional investors"
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
            {syncing ? "Syncing..." : "Sync Data"}
          </Button>
        )
      }
    />
  );
}













