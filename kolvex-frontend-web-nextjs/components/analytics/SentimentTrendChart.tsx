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
} from "recharts";
import { cn } from "@/lib/utils";
import type {
  TrendDataPoint,
  TrendSummary,
  DailySentiment,
} from "@/lib/analyticsApi";

// ============================================================
// Types
// ============================================================

interface ChartDataPoint {
  date: string;
  displayDate: string;
  tweetCount: number;
  netSentiment: number;
  bullish: number;
  bearish: number;
  neutral: number;
}

interface SentimentTrendChartProps {
  trends: TrendDataPoint[];
  summary: TrendSummary;
  dailySentiment?: DailySentiment[];
  title?: string;
  height?: number;
  className?: string;
}

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
      tweetCount: trend.count,
      netSentiment: sentiment.bullish - sentiment.bearish,
      bullish: sentiment.bullish,
      bearish: sentiment.bearish,
      neutral: sentiment.neutral,
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

  return (
    <div className="bg-zinc-900 text-white px-4 py-3 rounded-lg shadow-xl border border-zinc-700 min-w-[160px]">
      <p className="text-sm font-semibold text-white mb-2">
        {data.displayDate}
      </p>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-400">Tweets</span>
          <span className="text-sm font-bold text-white">
            {data.tweetCount.toLocaleString()}
          </span>
        </div>
        {hasSentiment && (
          <>
            <div className="flex justify-between items-center">
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
// Main Component
// ============================================================

export function SentimentTrendChart({
  trends,
  summary,
  dailySentiment,
  title = "Activity & Sentiment",
  height = 280,
  className,
}: SentimentTrendChartProps) {
  const data = useMemo(
    () => processData(trends, dailySentiment),
    [trends, dailySentiment]
  );

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
  const maxCount = Math.max(...data.map((d) => d.tweetCount), 1);
  const maxSentiment = Math.max(
    ...data.map((d) => Math.abs(d.netSentiment)),
    1
  );
  const sentimentDomain = [-maxSentiment - 2, maxSentiment + 2];

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
            {summary.days_analyzed} days ·{" "}
            {summary.total_tweets.toLocaleString()} tweets
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

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              {/* Solid color gradient for better visibility */}
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

            {/* Left Y-axis: Tweet Count */}
            <YAxis
              yAxisId="tweets"
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

            {/* Tweet count bars - solid green */}
            <Bar
              yAxisId="tweets"
              dataKey="tweetCount"
              fill="url(#barGradient)"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />

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
      <div className="px-5 pb-4 flex items-center justify-center gap-8 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded-sm bg-emerald-500" />
          <span className="text-muted-foreground">Tweets</span>
        </div>
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
