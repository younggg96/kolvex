"use client";

import React, { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import type { KOLTweet } from "@/lib/kolTweetsApi";

// ============================================================
// Types
// ============================================================

interface BubbleDataPoint {
  username: string;
  confidence: number;
  views: number;
  engagement: number;
  sentiment: "bullish" | "bearish" | "neutral";
  tweetCount: number;
}

interface KOLBubbleChartProps {
  tweets: KOLTweet[];
  title?: string;
  height?: number;
  className?: string;
}

// ============================================================
// Data Processing
// ============================================================

function processData(tweets: KOLTweet[]): BubbleDataPoint[] {
  const kolMap = new Map<
    string,
    {
      views: number;
      likes: number;
      retweets: number;
      confidenceSum: number;
      confidenceCount: number;
      sentimentCounts: { bullish: number; bearish: number; neutral: number };
      tweetCount: number;
    }
  >();

  tweets.forEach((tweet) => {
    const sentiment = tweet.sentiment;
    if (!sentiment?.confidence) return;

    const existing = kolMap.get(tweet.username) || {
      views: 0,
      likes: 0,
      retweets: 0,
      confidenceSum: 0,
      confidenceCount: 0,
      sentimentCounts: { bullish: 0, bearish: 0, neutral: 0 },
      tweetCount: 0,
    };

    existing.views += tweet.views_count || 0;
    existing.likes += tweet.like_count || 0;
    existing.retweets += tweet.retweet_count || 0;
    existing.confidenceSum += sentiment.confidence;
    existing.confidenceCount += 1;
    existing.tweetCount += 1;

    const sentValue = sentiment.value || "neutral";
    if (sentValue === "bullish") existing.sentimentCounts.bullish += 1;
    else if (sentValue === "bearish") existing.sentimentCounts.bearish += 1;
    else existing.sentimentCounts.neutral += 1;

    kolMap.set(tweet.username, existing);
  });

  const result: BubbleDataPoint[] = [];
  kolMap.forEach((data, username) => {
    if (data.confidenceCount === 0) return;

    const { bullish, bearish, neutral } = data.sentimentCounts;
    let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
    if (bullish > bearish && bullish > neutral) sentiment = "bullish";
    else if (bearish > bullish && bearish > neutral) sentiment = "bearish";

    result.push({
      username,
      confidence: data.confidenceSum / data.confidenceCount,
      views: data.views,
      engagement: data.likes + data.retweets,
      sentiment,
      tweetCount: data.tweetCount,
    });
  });

  return result.sort((a, b) => b.views - a.views).slice(0, 50);
}

function formatViews(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

// ============================================================
// Custom Tooltip
// ============================================================

interface TooltipPayload {
  payload: BubbleDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-zinc-900 text-white px-4 py-3 rounded-lg shadow-xl border border-zinc-700 min-w-[180px]">
      <p className="text-sm font-bold text-white mb-2">@{data.username}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-400">Views</span>
          <span className="font-semibold">{formatViews(data.views)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Confidence</span>
          <span className="font-semibold">
            {(data.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Engagement</span>
          <span className="font-semibold">{formatViews(data.engagement)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Sentiment</span>
          <span className="font-semibold capitalize text-white">
            {data.sentiment}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Tweets</span>
          <span className="font-semibold">{data.tweetCount}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function KOLBubbleChart({
  tweets,
  title = "KOL Influence vs Confidence",
  height = 350,
  className,
}: KOLBubbleChartProps) {
  const data = useMemo(() => processData(tweets), [tweets]);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-card/50 p-6">
        <p className="text-muted-foreground text-center text-sm">
          No data available
        </p>
      </div>
    );
  }

  const sizeRange = [80, 1500];

  // Green/Red color scheme
  const getSentimentColor = (sentiment: string) => {
    if (sentiment === "bullish") return "#22c55e"; // green-500
    if (sentiment === "bearish") return "#ef4444"; // red-500
    return "#6b7280"; // gray-500
  };

  const getSentimentOpacity = (sentiment: string) => {
    if (sentiment === "bullish") return 0.85;
    if (sentiment === "bearish") return 0.75;
    return 0.5;
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-card/50 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-zinc-200/40 dark:border-zinc-800/80">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Size = engagement · Opacity = sentiment strength
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Bullish</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-muted-foreground">Bearish</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-500/60" />
            <span className="text-muted-foreground">Neutral</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              opacity={0.3}
            />
            <XAxis
              dataKey="confidence"
              type="number"
              domain={[0, 1]}
              name="Confidence"
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              label={{
                value: "AI Confidence",
                position: "bottom",
                offset: 0,
                style: { fontSize: 11, fill: "#6b7280" },
              }}
            />
            <YAxis
              dataKey="views"
              type="number"
              scale="log"
              domain={["auto", "auto"]}
              name="Views"
              tickFormatter={formatViews}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              label={{
                value: "Views (log)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#6b7280" },
              }}
            />
            <ZAxis
              dataKey="engagement"
              type="number"
              range={sizeRange}
              name="Engagement"
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <ReferenceLine
              x={0.7}
              stroke="#6b7280"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
            <Scatter data={data}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getSentimentColor(entry.sentiment)}
                  fillOpacity={getSentimentOpacity(entry.sentiment)}
                  stroke={getSentimentColor(entry.sentiment)}
                  strokeWidth={1}
                  strokeOpacity={0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 text-center">
        <p className="text-xs text-muted-foreground">
          Top {data.length} KOLs · Dashed line = 70% confidence threshold
        </p>
      </div>
    </div>
  );
}

export default KOLBubbleChart;
