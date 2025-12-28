"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { CorrelationMatrix } from "@/lib/analyticsApi";
import { EmptyState } from "../common";

interface EngagementHeatmapProps {
  data: CorrelationMatrix;
  title?: string;
}

export function EngagementHeatmap({
  data,
  title = "Engagement Correlation",
}: EngagementHeatmapProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <EmptyState
        title="No data available"
        description="No engagement data available"
      />
    );
  }

  const metrics = Object.keys(data);
  const labels: Record<string, string> = {
    views: "Views",
    likes: "Likes",
    retweets: "Retweets",
    replies: "Replies",
    bookmarks: "Saves",
  };

  // Use primary color with varying opacity
  const getColorStyle = (value: number, isDiagonal: boolean) => {
    if (isDiagonal) return "bg-primary text-primary-foreground";
    if (value >= 0.8) return "bg-primary/80 text-primary-foreground";
    if (value >= 0.6) return "bg-primary/60 text-primary-foreground";
    if (value >= 0.4) return "bg-primary/40 text-foreground";
    if (value >= 0.2) return "bg-primary/20 text-foreground";
    return "bg-muted/30 text-muted-foreground";
  };

  return (
    <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-zinc-200/40 dark:border-zinc-800/80">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Metric relationships
        </p>
      </div>

      {/* Heatmap */}
      <div className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="p-2 w-20"></th>
                {metrics.map((m) => (
                  <th
                    key={m}
                    className="p-2 text-[10px] text-muted-foreground font-medium text-center uppercase tracking-wider"
                  >
                    {labels[m] || m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((row) => (
                <tr key={row}>
                  <td className="p-2 text-[10px] uppercase tracking-wider">
                    {labels[row] || row}
                  </td>
                  {metrics.map((col) => {
                    const value = data[row]?.[col] ?? 0;
                    const isDiagonal = row === col;
                    return (
                      <td key={col} className="p-1">
                        <div
                          className={cn(
                            "w-12 h-12 flex items-center justify-center rounded-lg",
                            "text-xs font-medium transition-all duration-200",
                            "hover:scale-105",
                            getColorStyle(value, isDiagonal)
                          )}
                          title={`${labels[row] || row} ↔ ${
                            labels[col] || col
                          }: ${value.toFixed(3)}`}
                        >
                          {value.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="text-xs text-muted-foreground">Weak</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded bg-muted/30" />
            <div className="w-4 h-4 rounded bg-primary/20" />
            <div className="w-4 h-4 rounded bg-primary/40" />
            <div className="w-4 h-4 rounded bg-primary/60" />
            <div className="w-4 h-4 rounded bg-primary/80" />
            <div className="w-4 h-4 rounded bg-primary" />
          </div>
          <span className="text-xs text-muted-foreground">Strong</span>
        </div>
      </div>
    </div>
  );
}
