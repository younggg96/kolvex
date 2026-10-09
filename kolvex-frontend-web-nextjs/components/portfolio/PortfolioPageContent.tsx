"use client";

import { useEffect, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PortfolioHoldings, {
  type PortfolioHeaderActionsProps,
} from "@/components/portfolio/PortfolioHoldings";
import { PortfolioSkeleton } from "./PortfolioSkeleton";
import { useAuth } from "@/hooks";
import { PortfolioHeaderActions } from "./PortfolioHeaderActions";
import { useTranslation } from "@/lib/i18n";
import PortfolioChanges from "@/components/decision/PortfolioChanges";

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
      <DashboardLayout title={t("portfolio.loadingTitle")}>
        <div className="mx-auto w-full max-w-[1080px] px-4 pt-6 md:px-8">
          <PortfolioSkeleton className="!mt-0" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={t("portfolio.title")}
      headerActions={
        headerActionsProps ? (
          <PortfolioHeaderActions {...headerActionsProps} size="sm" />
        ) : undefined
      }
    >
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full min-w-0 max-w-[1080px] px-4 pb-16 pt-6 md:px-8 md:pt-8">
          {user && (
            <PortfolioHoldings
              userId={user.id}
              isOwner={true}
              onHeaderActionsReady={setHeaderActionsProps}
              renderAfterSummary={(tickers) => <PortfolioChanges tickers={tickers} />}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
