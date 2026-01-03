"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { TrendDataPoint, TrendSummary } from "@/lib/analyticsApi";

interface TrendChartProps {
  data: TrendDataPoint[];
  summary: TrendSummary;
  title?: string;
  height?: number;
}

export function TrendChart({
  data,
  summary,
  title = "Tweet Activity",
  height = 200,
}: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-card/50 p-6">
        <p className="text-muted-foreground text-center text-sm">
          No data available
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-zinc-200/40 dark:border-zinc-800/80">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {summary.days_analyzed} days
          </p>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-base font-semibold text-foreground">
              {summary.total_posts.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Daily Avg</p>
            <p className="text-base font-semibold text-foreground">
              {summary.average_daily.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-5">
        <div
          className="flex items-end gap-[2px] w-full"
          style={{ height: `${height}px` }}
        >
          {data.map((item) => {
            const barHeight = (item.count / maxCount) * 100;
            const isPeak = item.date === summary.peak_date;
            return (
              <div
                key={item.date}
                className="flex-1 group relative cursor-pointer"
                style={{ height: "100%" }}
              >
                <div
                  className={cn(
                    "absolute bottom-0 w-full rounded-t transition-all duration-200",
                    isPeak
                      ? "bg-primary"
                      : "bg-primary/40 group-hover:bg-primary/70"
                  )}
                  style={{ height: `${Math.max(barHeight, 2)}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                  <div className="bg-popover text-popover-foreground px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg border border-zinc-200/60 dark:border-zinc-700">
                    <div className="font-medium">{item.date}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {item.count.toLocaleString()} tweets
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* X axis */}
        <div className="flex justify-between mt-3 text-xs text-muted-foreground">
          <span>{data[0]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>

        {/* Peak indicator */}
        {summary.peak_date && (
          <div className="mt-4 text-xs text-muted-foreground">
            Peak:{" "}
            <span className="text-foreground font-medium">
              {summary.peak_date}
            </span>
            <span className="ml-1">
              ({summary.max_daily.toLocaleString()} tweets)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
