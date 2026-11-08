"use client";

import { useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PortfolioHoldings from "@/components/portfolio/PortfolioHoldings";
import { PortfolioSkeleton } from "./PortfolioSkeleton";
import { useAuth } from "@/hooks";
import { useTranslation } from "@/lib/i18n";
import PortfolioChanges from "@/components/decision/PortfolioChanges";

export function PortfolioPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

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
        <div className="mx-auto w-full  px-[16px] pt-6 md:px-8">
          <PortfolioSkeleton className="!mt-0" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t("portfolio.title")}>
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full min-w-0  px-[16px] pb-10 pt-6 md:px-8 md:pt-8">
          {user && (
            <PortfolioHoldings
              userId={user.id}
              isOwner={true}
              renderAfterSummary={(tickers) => <PortfolioChanges tickers={tickers} />}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
