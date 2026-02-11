"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { AnalyticsDashboard } from "@/components/analytics";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw } from "lucide-react";

export default function AnalyticsPageClient() {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<{
    source?: "snapshot" | "realtime";
    createdAt?: string;
    coverage?: number;
  }>({});

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const handleDataSourceChange = useCallback(
    (
      source?: "snapshot" | "realtime",
      createdAt?: string,
      coverage?: number
    ) => {
      setDataSource({ source, createdAt, coverage });
    },
    []
  );

  // Header actions for desktop and mobile
  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleRefresh}
        variant="ghost"
        size="sm"
        disabled={isLoading}
        className="gap-1.5 h-8"
      >
        <RotateCcw className="w-3 h-3" />
      </Button>
      <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
        <SelectTrigger className="w-24 sm:w-28 h-8 text-xs sm:text-sm">
          <SelectValue placeholder={t("analytics.selectRange")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">{t("analytics.days", { count: "7" })}</SelectItem>
          <SelectItem value="14">{t("analytics.days", { count: "14" })}</SelectItem>
          <SelectItem value="30">{t("analytics.days", { count: "30" })}</SelectItem>
        </SelectContent>
      </Select>
      {/* Data source indicator - hidden on mobile */}
      {dataSource.source && (
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground ml-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              dataSource.source === "snapshot"
                ? "bg-green-500"
                : "bg-yellow-500"
            }`}
          />
          <span className="hidden lg:inline">
            {dataSource.source === "snapshot" ? t("analytics.snapshot") : t("analytics.realtime")}
          </span>
          {dataSource.coverage !== undefined && (
            <span className="hidden xl:inline">
              • {t("analytics.analyzed", { percent: dataSource.coverage.toFixed(1) })}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout
      title={t("analytics.title")}
      showHeader={true}
      headerActions={headerActions}
    >
      <div className="relative flex-1 flex flex-col min-h-0 bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative flex-1 p-4 md:p-6 overflow-auto">
          <AnalyticsDashboard
            days={days}
            refreshTrigger={refreshTrigger}
            onLoadingChange={handleLoadingChange}
            onDataSourceChange={handleDataSourceChange}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
