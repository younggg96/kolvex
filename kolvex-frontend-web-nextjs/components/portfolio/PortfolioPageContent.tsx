"use client";

import { useEffect, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PortfolioHoldings, {
  type PortfolioHeaderActionsProps,
} from "@/components/portfolio/PortfolioHoldings";
import { PortfolioHeroSection } from "./PortfolioHeroSection";
import { PortfolioSkeleton } from "./PortfolioSkeleton";
import { useAuth } from "@/hooks";
import { PortfolioHeaderActions } from "./PortfolioHeaderActions";
import { useTranslation } from "@/lib/i18n";

export function PortfolioPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();
  const [headerActionsProps, setHeaderActionsProps] =
    useState<PortfolioHeaderActionsProps | null>(null);

  // Handle connection callback
  const handleConnectionCallback = useCallback(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "true") {
      toast.success(t("portfolio.brokerConnected"));
      router.replace("/dashboard/portfolio");
    } else if (error) {
      toast.error(t("portfolio.connectionFailed", { error: error || "" }));
      router.replace("/dashboard/portfolio");
    }
  }, [searchParams, router, t]);

  useEffect(() => {
    handleConnectionCallback();
  }, [handleConnectionCallback]);

  // Show loading while auth is loading
  if (isLoading) {
    return (
      <DashboardLayout headerClassName="lg:hidden" title={t("portfolio.loadingTitle")}>
        <div className="relative min-w-0 space-y-3">
          {/* Hero Skeleton */}
          <PortfolioHeroSection className="lg:block hidden" />
          {/* Content Skeleton */}
          <PortfolioSkeleton className="p-4 !mt-0" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={t("portfolio.title")}
      headerClassName="lg:hidden"
      headerActions={
        headerActionsProps ? (
          <PortfolioHeaderActions {...headerActionsProps} size="xs" />
        ) : undefined
      }
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        {/* Hero Section */}
        <PortfolioHeroSection
          headerActionsProps={headerActionsProps ?? undefined}
          className="hidden lg:block"
        />
        <div className="relative p-4 min-w-0 space-y-6">
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
