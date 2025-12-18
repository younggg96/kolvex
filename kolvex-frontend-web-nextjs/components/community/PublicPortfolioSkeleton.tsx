"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PortfolioSkeleton } from "../portfolio/PortfolioSkeleton";

interface PublicPortfolioSkeletonProps {
  onBack: () => void;
}

export function PublicPortfolioSkeleton({
  onBack,
}: PublicPortfolioSkeletonProps) {
  return (
    <DashboardLayout showHeader={false}>
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative p-4 min-w-0 space-y-4">
          {/* Back Button */}
          <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {/* Profile Header Skeleton */}
          <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>

          <PortfolioSkeleton />
        </div>
      </div>
    </DashboardLayout>
  );
}
