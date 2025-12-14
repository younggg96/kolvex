"use client";

import { useEffect, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Globe, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PortfolioHoldings, {
  type PortfolioHeaderActionsProps,
} from "@/components/portfolio/PortfolioHoldings";
import { PortfolioHeroSection } from "./PortfolioHeroSection";
import { PortfolioSkeleton } from "./PortfolioSkeleton";
import { useAuth } from "@/hooks";

export function PortfolioPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [headerActionsProps, setHeaderActionsProps] =
    useState<PortfolioHeaderActionsProps | null>(null);

  // Handle connection callback
  const handleConnectionCallback = useCallback(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "true") {
      toast.success(
        "Broker connected successfully! Click 'Sync Data' to fetch your holdings."
      );
      router.replace("/dashboard/portfolio");
    } else if (error) {
      toast.error(`Connection failed: ${error}`);
      router.replace("/dashboard/portfolio");
    }
  }, [searchParams, router]);

  useEffect(() => {
    handleConnectionCallback();
  }, [handleConnectionCallback]);

  // Show loading while auth is loading
  if (isLoading) {
    return (
      <DashboardLayout showHeader={false}>
        <div className="relative p-4 min-w-0 space-y-6">
          {/* Hero Skeleton */}
          <PortfolioHeroSection />
          {/* Content Skeleton */}
          <PortfolioSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout showHeader={false}>
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative p-4 min-w-0 space-y-6">
          {/* Hero Section */}
          <PortfolioHeroSection
            headerActionsProps={headerActionsProps ?? undefined}
          />

          {/* Main Portfolio Content */}
          {user && (
            <PortfolioHoldings
              userId={user.id}
              isOwner={true}
              onHeaderActionsReady={setHeaderActionsProps}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
