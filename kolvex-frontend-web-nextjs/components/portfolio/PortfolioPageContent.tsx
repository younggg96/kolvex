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

          {/* Community CTA (shown when portfolio has holdings) */}
          {headerActionsProps?.holdings?.is_public && (
            <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-transparent dark:from-green-500/20 dark:via-emerald-500/10 rounded-xl p-4 border border-green-500/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Your Portfolio is Public
                      </h3>
                      <Badge
                        variant="outline"
                        className="border-green-500/30 text-green-600 dark:text-green-400 text-[10px]"
                      >
                        Live
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-white/60">
                      Other investors can view and learn from your holdings
                    </p>
                  </div>
                </div>
                <Link href="/community">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10"
                  >
                    <Eye className="w-4 h-4" />
                    View in Community
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
