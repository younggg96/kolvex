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
import { KOLBubbleChart } from "./KOLBubbleChart";
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
import { getKOLTweets, type KOLTweet } from "@/lib/kolTweetsApi";
import { TickerHeatmap } from "@/components/analytics";

interface AnalyticsDashboardProps {
  className?: string;
}

export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [tweets, setTweets] = useState<KOLTweet[]>([]);

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

      setDashboard(dashboardData);
      setTrends(trendsData);
      setSentiment(sentimentData);
      setEngagement(engagementData);

      // Fetch tweets separately (optional, for bubble/treemap charts)
      // Backend limits page_size to max 100
      try {
        const tweetsData = await getKOLTweets({ page_size: 100 });
        setTweets(tweetsData.tweets || []);
      } catch (tweetsErr) {
        console.warn("Failed to fetch tweets for charts:", tweetsErr);
        setTweets([]);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
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
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Overview Stats */}
          {dashboard && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Tweets"
                value={dashboard.overview.total_tweets.toLocaleString()}
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
                subtitle={`${dashboard.overview.avg_engagement_per_tweet.toFixed(
                  1
                )} per tweet`}
              />
              <StatsCard
                title="Active KOLs"
                value={dashboard.overview.unique_authors.toString()}
                subtitle={`${dashboard.overview.stock_related_tweets} stock-related`}
              />
            </div>
          )}

          {/* Trend & Sentiment Chart */}
          {trends && (
            <SentimentTrendChart
              trends={trends.trends}
              summary={trends.summary}
              dailySentiment={sentiment?.daily_trends}
              title="Activity & Sentiment"
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

          {/* KOL Bubble Chart & Ticker Treemap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tweets.length > 0 && (
              <KOLBubbleChart
                tweets={tweets}
                title="KOL Influence vs Confidence"
                height={380}
              />
            )}
            {tweets.length > 0 && (
              <TickerHeatmap
                tweets={tweets}
                title="Ticker Heatmap"
                height={380}
                limit={20}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
