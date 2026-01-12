"use client";

import React, { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatsCard } from "./StatsCard";
import { SentimentTrendChart } from "./SentimentTrendChart";
import { SentimentChart } from "./SentimentChart";
import { EngagementHeatmap } from "./EngagementHeatmap";
import {
  getDashboardSummary,
  getTweetTrends,
  getSentimentAnalysis,
  getEngagementAnalysis,
  formatLargeNumber,
  type DashboardData,
  type TrendsData,
  type SentimentData,
  type EngagementData,
} from "@/lib/analyticsApi";

interface AnalyticsDashboardProps {
  className?: string;
  /** Controlled days prop from parent */
  days?: number;
  /** Trigger to refresh data */
  refreshTrigger?: number;
  /** Callback when loading state changes */
  onLoadingChange?: (loading: boolean) => void;
  /** Callback when data source changes */
  onDataSourceChange?: (
    source?: "snapshot" | "realtime",
    createdAt?: string,
    coverage?: number
  ) => void;
}

export function AnalyticsDashboard({
  className,
  days: propDays,
  refreshTrigger = 0,
  onLoadingChange,
  onDataSourceChange,
}: AnalyticsDashboardProps) {
  const days = propDays ?? 7;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);

  const fetchData = async () => {
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);

    try {
      // Fetch main analytics data
      const [dashboardData, trendsData, sentimentData, engagementData] =
        await Promise.all([
          getDashboardSummary(days),
          getTweetTrends(days),
          getSentimentAnalysis(days, undefined, true),
          getEngagementAnalysis(days),
        ]);

      setDashboard(dashboardData);
      setTrends(trendsData);
      setSentiment(sentimentData);
      setEngagement(engagementData);

      // Notify parent of data source change
      onDataSourceChange?.(
        dashboardData._source,
        dashboardData._snapshot_created_at,
        dashboardData.data_quality?.analysis_coverage
      );
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 自动刷新：每 5 分钟更新一次数据
    const interval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 分钟

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, refreshTrigger]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <div className="text-center">
          <p className="text-base font-medium text-foreground mb-1">
            Failed to Load
          </p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchData} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Overview Stats */}
          {dashboard && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Posts"
                value={dashboard.overview.total_posts.toLocaleString()}
                subtitle={`${dashboard.period.start_date} → ${dashboard.period.end_date}`}
              />
              <StatsCard
                title="Total Views"
                value={formatLargeNumber(dashboard.overview.total_views)}
                subtitle={`${formatLargeNumber(
                  Math.round(dashboard.overview.total_views / days)
                )} daily avg`}
              />
              <StatsCard
                title="Engagement"
                value={formatLargeNumber(dashboard.overview.total_engagement)}
                subtitle={`${dashboard.overview.avg_engagement_per_post} per post`}
              />
              <StatsCard
                title="Active KOLs"
                value={dashboard.overview.unique_authors.toString()}
                subtitle={`${dashboard.overview.stock_related_posts} stock-related posts analyzed`}
              />
            </div>
          )}

          {/* Trend & Sentiment Chart */}
          {trends && (
            <SentimentTrendChart
              trends={trends.trends}
              summary={trends.summary}
              dailySentiment={sentiment?.daily_trends}
              platformBreakdown={trends.platform_breakdown}
              title="Activity & Sentiment by Platform"
            />
          )}

          {/* Sentiment & Engagement */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sentiment && <SentimentChart data={sentiment} title="Sentiment" />}
            {engagement && engagement.correlation_matrix && (
              <EngagementHeatmap
                data={engagement.correlation_matrix}
                title="Correlation"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Trend chart */}
      <Skeleton className="h-64 rounded-xl" />

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
