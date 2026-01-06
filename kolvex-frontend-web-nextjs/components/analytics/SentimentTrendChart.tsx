"use client";

import React, { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  CartesianGrid,
  Area,
} from "recharts";
import { cn } from "@/lib/utils";
import type {
  TrendDataPoint,
  TrendSummary,
  DailySentiment,
  PlatformBreakdown,
} from "@/lib/analyticsApi";

// ============================================================
// Types
// ============================================================

interface ChartDataPoint {
  date: string;
  displayDate: string;
  postCount: number;
  netSentiment: number;
  bullish: number;
  bearish: number;
  neutral: number;
  // Platform breakdown
  twitter: number;
  xiaohongshu: number;
  reddit: number;
  youtube: number;
}

interface SentimentTrendChartProps {
  trends: TrendDataPoint[];
  summary: TrendSummary;
  dailySentiment?: DailySentiment[];
  platformBreakdown?: PlatformBreakdown;
  title?: string;
  height?: number;
  className?: string;
}

// ============================================================
// Platform Config
// ============================================================

const PLATFORM_CONFIG = {
  twitter: {
    name: "X / Twitter",
    color: "#1DA1F4",
    icon: "𝕏",
  },
  xiaohongshu: {
    name: "xiaohongshu",
    color: "#FE2C55",
    icon: "📕",
  },
  reddit: {
    name: "Reddit",
    color: "#FF4500",
    icon: "🔴",
  },
  youtube: {
    name: "YouTube",
    color: "#FF0000",
    icon: "▶️",
  },
};

// ============================================================
// Data Processing
// ============================================================

function processData(
  trends: TrendDataPoint[],
  dailySentiment?: DailySentiment[]
): ChartDataPoint[] {
  const sentimentMap = new Map<
    string,
    { bullish: number; bearish: number; neutral: number }
  >();

  if (dailySentiment) {
    dailySentiment.forEach((item) => {
      sentimentMap.set(item.date, {
        bullish: item.bullish,
        bearish: item.bearish,
        neutral: item.neutral,
      });
    });
  }

  return trends.map((trend) => {
    const sentiment = sentimentMap.get(trend.date) || {
      bullish: 0,
      bearish: 0,
      neutral: 0,
    };
    return {
      date: trend.date,
      displayDate: formatDate(trend.date),
      postCount: trend.count,
      netSentiment: sentiment.bullish - sentiment.bearish,
      bullish: sentiment.bullish,
      bearish: sentiment.bearish,
      neutral: sentiment.neutral,
      // Platform data
      twitter: trend.twitter || 0,
      xiaohongshu: trend.xiaohongshu || 0,
      reddit: trend.reddit || 0,
      youtube: trend.youtube || 0,
    };
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

// ============================================================
// Custom Tooltip
// ============================================================

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
  name: string;
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const hasSentiment = data.bullish > 0 || data.bearish > 0 || data.neutral > 0;
  const hasPlatformData =
    data.twitter > 0 ||
    data.xiaohongshu > 0 ||
    data.reddit > 0 ||
    data.youtube > 0;

  return (
    <div className="bg-zinc-900 text-white px-4 py-3 rounded-lg shadow-xl border border-zinc-700 min-w-[180px]">
      <p className="text-sm font-semibold text-white mb-2">
        {data.displayDate}
      </p>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-400">Total Posts</span>
          <span className="text-sm font-bold text-white">
            {data.postCount.toLocaleString()}
          </span>
        </div>

        {/* Platform breakdown */}
        {hasPlatformData && (
          <div className="pt-2 mt-2 border-t border-zinc-700 space-y-1">
            {data.twitter > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: PLATFORM_CONFIG.twitter.color }}
                  />
                  <span className="text-zinc-400">X / Twitter</span>
                </span>
                <span className="text-xs font-medium text-white">
                  {data.twitter.toLocaleString()}
                </span>
              </div>
            )}
            {data.xiaohongshu > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: PLATFORM_CONFIG.xiaohongshu.color,
                    }}
                  />
                  <span className="text-zinc-400">Xiaohongshu</span>
                </span>
                <span className="text-xs font-medium text-white">
                  {data.xiaohongshu.toLocaleString()}
                </span>
              </div>
            )}
            {data.reddit > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: PLATFORM_CONFIG.reddit.color }}
                  />
                  <span className="text-zinc-400">Reddit</span>
                </span>
                <span className="text-xs font-medium text-white">
                  {data.reddit.toLocaleString()}
                </span>
              </div>
            )}
            {data.youtube > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: PLATFORM_CONFIG.youtube.color }}
                  />
                  <span className="text-zinc-400">YouTube</span>
                </span>
                <span className="text-xs font-medium text-white">
                  {data.youtube.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {hasSentiment && (
          <>
            <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
              <span className="text-xs text-zinc-400">Net Sentiment</span>
              <span
                className={cn(
                  "text-sm font-bold",
                  data.netSentiment > 0
                    ? "text-emerald-400"
                    : data.netSentiment < 0
                    ? "text-rose-400"
                    : "text-zinc-300"
                )}
              >
                {data.netSentiment > 0 ? "+" : ""}
                {data.netSentiment}
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-zinc-600 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  {data.bullish}
                </p>
                <p className="text-[10px] text-zinc-500">Bull</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-300">
                  {data.neutral}
                </p>
                <p className="text-[10px] text-zinc-500">Neut</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-rose-400">
                  {data.bearish}
                </p>
                <p className="text-[10px] text-zinc-500">Bear</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Platform Stats Component
// ============================================================

function PlatformStats({
  breakdown,
  total,
}: {
  breakdown: PlatformBreakdown;
  total: number;
}) {
  const platforms = [
    { key: "twitter", ...PLATFORM_CONFIG.twitter, count: breakdown.twitter },
    {
      key: "xiaohongshu",
      ...PLATFORM_CONFIG.xiaohongshu,
      count: breakdown.xiaohongshu,
    },
    { key: "reddit", ...PLATFORM_CONFIG.reddit, count: breakdown.reddit },
    { key: "youtube", ...PLATFORM_CONFIG.youtube, count: breakdown.youtube },
  ].filter((p) => p.count > 0);

  if (platforms.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {platforms.map((platform) => (
        <div
          key={platform.key}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: platform.color }}
          />
          <span className="text-xs font-medium text-foreground">
            {platform.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {platform.count.toLocaleString()}
          </span>
          <span className="text-[10px] text-muted-foreground">
            ({((platform.count / total) * 100).toFixed(0)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function SentimentTrendChart({
  trends,
  summary,
  dailySentiment,
  platformBreakdown,
  title = "Activity & Sentiment",
  height = 280,
  className,
}: SentimentTrendChartProps) {
  const data = useMemo(
    () => processData(trends, dailySentiment),
    [trends, dailySentiment]
  );

  // Check if we have platform data
  const hasPlatformData = useMemo(() => {
    return data.some(
      (d) => d.twitter > 0 || d.xiaohongshu > 0 || d.reddit > 0 || d.youtube > 0
    );
  }, [data]);

  // Get active platforms for stacked bars
  const activePlatforms = useMemo(() => {
    if (!hasPlatformData) return [];
    const platforms: Array<keyof typeof PLATFORM_CONFIG> = [];
    const totals = { twitter: 0, xiaohongshu: 0, reddit: 0, youtube: 0 };
    data.forEach((d) => {
      totals.twitter += d.twitter;
      totals.xiaohongshu += d.xiaohongshu;
      totals.reddit += d.reddit;
      totals.youtube += d.youtube;
    });
    if (totals.twitter > 0) platforms.push("twitter");
    if (totals.xiaohongshu > 0) platforms.push("xiaohongshu");
    if (totals.reddit > 0) platforms.push("reddit");
    if (totals.youtube > 0) platforms.push("youtube");
    return platforms;
  }, [data, hasPlatformData]);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-card/50 p-6">
        <p className="text-muted-foreground text-center text-sm">
          No data available
        </p>
      </div>
    );
  }

  const hasSentiment = dailySentiment && dailySentiment.length > 0;
  const maxCount = Math.max(...data.map((d) => d.postCount), 1);
  const maxSentiment = Math.max(
    ...data.map((d) => Math.abs(d.netSentiment)),
    1
  );
  const sentimentDomain = [-maxSentiment - 2, maxSentiment + 2];

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-card-light dark:bg-card-dark/50 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 p-5 border-b border-zinc-200/40 dark:border-zinc-800/80">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.days_analyzed} days ·{" "}
              {summary.total_posts.toLocaleString()} posts
            </p>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Daily Avg</p>
              <p className="text-base font-bold text-foreground">
                {summary.average_daily.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Peak</p>
              <p className="text-base font-bold text-foreground">
                {summary.max_daily.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Platform breakdown stats */}
        {platformBreakdown && (
          <PlatformStats
            breakdown={platformBreakdown}
            total={summary.total_posts}
          />
        )}
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              {/* Platform gradients */}
              <linearGradient id="twitterGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={PLATFORM_CONFIG.twitter.color}
                  stopOpacity={0.9}
                />
                <stop
                  offset="100%"
                  stopColor={PLATFORM_CONFIG.twitter.color}
                  stopOpacity={0.6}
                />
              </linearGradient>
              <linearGradient
                id="xiaohongshuGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={PLATFORM_CONFIG.xiaohongshu.color}
                  stopOpacity={0.9}
                />
                <stop
                  offset="100%"
                  stopColor={PLATFORM_CONFIG.xiaohongshu.color}
                  stopOpacity={0.6}
                />
              </linearGradient>
              <linearGradient id="redditGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={PLATFORM_CONFIG.reddit.color}
                  stopOpacity={0.9}
                />
                <stop
                  offset="100%"
                  stopColor={PLATFORM_CONFIG.reddit.color}
                  stopOpacity={0.6}
                />
              </linearGradient>
              <linearGradient id="youtubeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={PLATFORM_CONFIG.youtube.color}
                  stopOpacity={0.9}
                />
                <stop
                  offset="100%"
                  stopColor={PLATFORM_CONFIG.youtube.color}
                  stopOpacity={0.6}
                />
              </linearGradient>
              {/* Fallback gradient for total */}
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.5} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#374151"
              opacity={0.5}
            />

            {/* Left Y-axis: Post Count */}
            <YAxis
              yAxisId="posts"
              orientation="left"
              tickFormatter={formatCount}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              width={45}
              domain={[0, maxCount * 1.15]}
            />

            {/* Right Y-axis: Sentiment */}
            {hasSentiment && (
              <YAxis
                yAxisId="sentiment"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                width={35}
                domain={sentimentDomain}
                tickFormatter={(v) => (v > 0 ? `+${v}` : String(v))}
              />
            )}

            <XAxis
              dataKey="displayDate"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              interval="preserveStartEnd"
              minTickGap={60}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />

            {/* Reference line at y=0 */}
            {hasSentiment && (
              <ReferenceLine
                yAxisId="sentiment"
                y={0}
                stroke="#6b7280"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}

            {/* Stacked bars by platform or single bar */}
            {hasPlatformData && activePlatforms.length > 0 ? (
              <>
                {activePlatforms.includes("twitter") && (
                  <Bar
                    yAxisId="posts"
                    dataKey="twitter"
                    stackId="platform"
                    fill="url(#twitterGradient)"
                    radius={
                      activePlatforms[activePlatforms.length - 1] === "twitter"
                        ? [4, 4, 0, 0]
                        : [0, 0, 0, 0]
                    }
                    maxBarSize={50}
                  />
                )}
                {activePlatforms.includes("xiaohongshu") && (
                  <Bar
                    yAxisId="posts"
                    dataKey="xiaohongshu"
                    stackId="platform"
                    fill="url(#xiaohongshuGradient)"
                    radius={
                      activePlatforms[activePlatforms.length - 1] ===
                      "xiaohongshu"
                        ? [4, 4, 0, 0]
                        : [0, 0, 0, 0]
                    }
                    maxBarSize={50}
                  />
                )}
                {activePlatforms.includes("reddit") && (
                  <Bar
                    yAxisId="posts"
                    dataKey="reddit"
                    stackId="platform"
                    fill="url(#redditGradient)"
                    radius={
                      activePlatforms[activePlatforms.length - 1] === "reddit"
                        ? [4, 4, 0, 0]
                        : [0, 0, 0, 0]
                    }
                    maxBarSize={50}
                  />
                )}
                {activePlatforms.includes("youtube") && (
                  <Bar
                    yAxisId="posts"
                    dataKey="youtube"
                    stackId="platform"
                    fill="url(#youtubeGradient)"
                    radius={
                      activePlatforms[activePlatforms.length - 1] === "youtube"
                        ? [4, 4, 0, 0]
                        : [0, 0, 0, 0]
                    }
                    maxBarSize={50}
                  />
                )}
              </>
            ) : (
              <Bar
                yAxisId="posts"
                dataKey="postCount"
                fill="url(#barGradient)"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            )}

            {/* Sentiment line - bright cyan */}
            {hasSentiment && (
              <Line
                yAxisId="sentiment"
                type="monotone"
                dataKey="netSentiment"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "#06b6d4",
                  stroke: "#0e1117",
                  strokeWidth: 2,
                }}
              />
            )}

            {/* Brush for zooming */}
            {data.length > 10 && (
              <Brush
                dataKey="displayDate"
                height={28}
                stroke="#374151"
                fill="#1f2937"
                tickFormatter={() => ""}
                startIndex={Math.max(0, data.length - 14)}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="px-5 pb-4 flex flex-wrap items-center justify-center gap-4 text-xs">
        {hasPlatformData ? (
          <>
            {activePlatforms.map((platform) => (
              <div key={platform} className="flex items-center gap-2">
                <div
                  className="w-4 h-3 rounded-sm"
                  style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
                />
                <span className="text-muted-foreground">
                  {PLATFORM_CONFIG[platform].name}
                </span>
              </div>
            ))}
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded-sm bg-emerald-500" />
            <span className="text-muted-foreground">Posts</span>
          </div>
        )}
        {hasSentiment && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-5 h-[3px] rounded-full bg-cyan-500" />
              <span className="text-muted-foreground">Net Sentiment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 border-t-2 border-dashed border-gray-500" />
              <span className="text-muted-foreground">Zero</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SentimentTrendChart;
