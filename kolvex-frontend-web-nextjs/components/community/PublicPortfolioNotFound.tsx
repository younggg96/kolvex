"use client";

import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";

interface PublicPortfolioNotFoundProps {
  onBack: () => void;
}

export function PublicPortfolioNotFound({
  onBack,
}: PublicPortfolioNotFoundProps) {
  return (
    <DashboardLayout showHeader={false}>
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative p-4 min-w-0 space-y-4">
          <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            Back to Community
          </Button>

          <SectionCard useSectionHeader={false}>
            <EmptyState
              icon={Lock}
              title="Portfolio Not Available"
              description="This portfolio is private or doesn't exist."
            />
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}

