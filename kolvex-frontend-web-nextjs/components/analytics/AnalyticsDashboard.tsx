"use client";

import React, { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { RotateCcw } from "lucide-react";

interface AnalyticsDashboardProps {
  className?: string;
}

export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);

  const fetchData = async () => {
    setLoading(true);
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
      console.log("dashboardData", dashboardData);
      console.log("trendsData", trendsData);
      console.log("sentimentData", sentimentData);
      console.log("engagementData", engagementData);

      setDashboard(dashboardData);
      setTrends(trendsData);
      setSentiment(sentimentData);
      setEngagement(engagementData);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 自动刷新：每 5 分钟更新一次数据
    const interval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 分钟

    return () => clearInterval(interval);
  }, [days]);

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            disabled={loading || generating}
            className="gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Select
            value={String(days)}
            onValueChange={(v) => setDays(Number(v))}
          >
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Data source indicator */}
        {dashboard && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {dashboard._source === "snapshot" ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span>
                  From snapshot{" "}
                  {dashboard._snapshot_created_at &&
                    `(${new Date(
                      dashboard._snapshot_created_at
                    ).toLocaleString()})`}
                </span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
                <span>Realtime data</span>
              </>
            )}
            {dashboard.data_quality && (
              <span className="ml-2">
                • {dashboard.data_quality.analysis_coverage.toFixed(1)}%
                analyzed
              </span>
            )}
          </div>
        )}
      </div>

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
