"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-5",
        "bg-card-light dark:bg-card-dark/50 backdrop-blur-sm",
        "border-zinc-200/60 dark:border-zinc-800",
        "transition-all duration-200 hover:border-primary/40 dark:hover:border-primary/30",
        className
      )}
    >
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          {title}
        </p>
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={cn(
                "text-xs font-semibold",
                trend.value >= 0 ? "text-primary" : "text-muted-foreground"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
