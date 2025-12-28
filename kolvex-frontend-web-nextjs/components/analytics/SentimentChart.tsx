"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { SentimentData } from "@/lib/analyticsApi";

interface SentimentChartProps {
  data: SentimentData;
  title?: string;
}

export function SentimentChart({
  data,
  title = "Market Sentiment",
}: SentimentChartProps) {
  const { distribution, metrics } = data;
  const total = metrics.total_analyzed;

  if (total === 0) {
    return (
      <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-card/50 p-6">
        <p className="text-muted-foreground text-center text-sm">
          No data available
        </p>
      </div>
    );
  }

  const segments = [
    {
      key: "bullish",
      label: "Bullish",
      count: distribution.counts.bullish,
      percentage: distribution.percentages.bullish,
      color: "bg-primary",
    },
    {
      key: "neutral",
      label: "Neutral",
      count: distribution.counts.neutral,
      percentage: distribution.percentages.neutral,
      color: "bg-muted-foreground/40",
    },
    {
      key: "bearish",
      label: "Bearish",
      count: distribution.counts.bearish,
      percentage: distribution.percentages.bearish,
      color: "bg-primary/20",
    },
  ];

  const getSentimentLabel = (score: number) => {
    if (score > 0.5) return "Extremely Bullish";
    if (score > 0.2) return "Bullish";
    if (score > 0) return "Slightly Bullish";
    if (score === 0) return "Neutral";
    if (score > -0.2) return "Slightly Bearish";
    if (score > -0.5) return "Bearish";
    return "Extremely Bearish";
  };

  return (
    <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-zinc-200/40 dark:border-zinc-800/80">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total.toLocaleString()} posts analyzed
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-base font-semibold text-foreground">
            {metrics.sentiment_score >= 0 ? "+" : ""}
            {(metrics.sentiment_score * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Sentiment bar */}
        <div className="relative h-3 rounded-full overflow-hidden bg-muted/30">
          {segments.map((seg, index) => (
            <div
              key={seg.key}
              className={cn("absolute top-0 h-full", seg.color)}
              style={{
                left: `${segments
                  .slice(0, index)
                  .reduce((acc, s) => acc + s.percentage, 0)}%`,
                width: `${seg.percentage}%`,
              }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-4">
          {segments.map((seg) => (
            <div key={seg.key} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className={cn("w-2 h-2 rounded-full", seg.color)} />
                <span className="text-xs text-muted-foreground">
                  {seg.label}
                </span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {seg.percentage.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {seg.count.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Current sentiment label */}
        <div className="text-center pt-2 border-t border-zinc-200/30 dark:border-zinc-800/60">
          <span className="text-xs text-muted-foreground">Current: </span>
          <span className="text-xs font-medium text-foreground">
            {getSentimentLabel(metrics.sentiment_score)}
          </span>
        </div>
      </div>
    </div>
  );
}
