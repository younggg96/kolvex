"use client";

import { useEffect, Suspense, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Briefcase,
  Globe,
  Eye,
  TrendingUp,
  Shield,
  Share2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import PortfolioHoldings, {
  PortfolioHeaderActions,
  type PortfolioHeaderActionsProps,
} from "@/components/portfolio/PortfolioHoldings";
import { useAuth } from "@/hooks";

function PortfolioContent() {
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
        <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
          <div className="relative p-4 min-w-0 space-y-6">
            {/* Hero Skeleton */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-primary/2 to-transparent border border-primary/10 p-6 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10" />
                <div className="space-y-2">
                  <div className="h-5 w-32 bg-gray-200 dark:bg-white/10 rounded" />
                  <div className="h-3 w-48 bg-gray-200 dark:bg-white/10 rounded" />
                </div>
              </div>
            </div>
            {/* Content Skeleton */}
            <div className="bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl p-4 space-y-4 animate-pulse">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-gray-100 dark:bg-white/5 rounded-lg"
                  />
                ))}
              </div>
              <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Redirect if not logged in
  if (!user) {
    return (
      <DashboardLayout showHeader={false}>
        <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
          <div className="relative p-4 min-w-0 space-y-6">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10 dark:to-transparent border border-primary/20 p-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                      My Holdings
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-white/60">
                      Track and share your investment holdings
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Login prompt */}
            <SectionCard useSectionHeader={false} className="p-8">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-gray-400 dark:text-white/40" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    Login Required
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Please login to view and manage your portfolio
                  </p>
                </div>
                <Link href="/auth">
                  <Button className="gap-2">
                    Login to Continue
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </SectionCard>
          </div>
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
          <div className="relative overflow-hidden p-2">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                      My Holdings
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-white/60">
                      Track and share your investment holdings
                    </p>
                  </div>
                </div>
                {/* Actions */}
                {headerActionsProps && (
                  <PortfolioHeaderActions {...headerActionsProps} />
                )}
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border-light dark:border-border-dark rounded-full">
                  <Shield className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-white/70">
                    Secure Connection
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border-light dark:border-border-dark rounded-full">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-gray-700 dark:text-white/70">
                    Real-time Tracking
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border-light dark:border-border-dark rounded-full">
                  <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-white/70">
                    Optional Sharing
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Portfolio Content */}
          <PortfolioHoldings
            userId={user.id}
            isOwner={true}
            onHeaderActionsReady={setHeaderActionsProps}
          />

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

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout title="Portfolio">
          <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
            <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
            <div className="relative p-4 min-w-0 space-y-6">
              {/* Hero Skeleton */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-primary/2 to-transparent border border-primary/10 p-6 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10" />
                  <div className="space-y-2">
                    <div className="h-5 w-32 bg-gray-200 dark:bg-white/10 rounded" />
                    <div className="h-3 w-48 bg-gray-200 dark:bg-white/10 rounded" />
                  </div>
                </div>
              </div>
              {/* Content Skeleton */}
              <div className="bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl p-4 space-y-4 animate-pulse">
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-20 bg-gray-100 dark:bg-white/5 rounded-lg"
                    />
                  ))}
                </div>
                <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg" />
              </div>
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <PortfolioContent />
    </Suspense>
  );
}
