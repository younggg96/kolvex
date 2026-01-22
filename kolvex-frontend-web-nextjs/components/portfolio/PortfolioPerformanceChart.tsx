"use client";

import React, { useEffect, useMemo } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, BarChart3, RefreshCw, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/snaptradeApi";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    usePortfolioHistory,
    type PerformancePeriod,
    type PerformanceDataPoint,
    type PerformanceSummary,
} from "./hooks/usePortfolioHistory";

// ============================================================
// Types
// ============================================================

interface PortfolioPerformanceChartProps {
    className?: string;
    height?: number;
}

// ============================================================
// Period Options
// ============================================================

const PERIOD_OPTIONS: { value: PerformancePeriod; label: string }[] = [
    { value: "1D", label: "1D" },
    { value: "1W", label: "1W" },
    { value: "1M", label: "1M" },
    { value: "3M", label: "3M" },
    { value: "YTD", label: "YTD" },
    { value: "ALL", label: "ALL" },
];

// ============================================================
// Custom Tooltip
// ============================================================

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        payload: PerformanceDataPoint;
    }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const isPositive = data.pnl >= 0;

    return (
        <div className="bg-card-dark/95 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl">
            <p className="text-xs text-gray-400 mb-1">{data.displayDate}</p>
            <p className="text-sm font-semibold text-white">
                {formatCurrency(data.value)}
            </p>
            <p
                className={cn(
                    "text-xs font-medium",
                    isPositive ? "text-emerald-400" : "text-red-400"
                )}
            >
                {isPositive ? "+" : ""}
                {formatCurrency(data.pnl)} ({formatPercent(data.pnlPercent)})
            </p>
        </div>
    );
}

// ============================================================
// Summary Stats
// ============================================================

interface SummaryStatsProps {
    summary: PerformanceSummary;
    period: PerformancePeriod;
}

function SummaryStats({ summary, period }: SummaryStatsProps) {
    const isPositive = summary.totalPnL >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Icon
                    className={cn(
                        "w-5 h-5",
                        isPositive ? "text-emerald-500" : "text-red-500"
                    )}
                />
                <span
                    className={cn(
                        "text-2xl font-bold tracking-tight",
                        isPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                    )}
                >
                    {formatPercent(summary.totalPnLPercent)}
                </span>
                <span
                    className={cn(
                        "text-sm font-medium",
                        isPositive
                            ? "text-emerald-600/80 dark:text-emerald-400/80"
                            : "text-red-600/80 dark:text-red-400/80"
                    )}
                >
                    ({isPositive ? "+" : ""}{formatCurrency(summary.totalPnL)})
                </span>
            </div>
            <span className="text-xs text-muted-foreground">
                {period === "1D" ? "Today" : period === "YTD" ? "Year to Date" : `Past ${period.replace("M", " month").replace("W", " week")}`}
            </span>
        </div>
    );
}

// ============================================================
// Loading Skeleton
// ============================================================

function ChartSkeleton({ height }: { height: number }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex gap-1">
                    {PERIOD_OPTIONS.map((opt) => (
                        <Skeleton key={opt.value} className="h-7 w-10" />
                    ))}
                </div>
            </div>
            <Skeleton className="w-full" style={{ height }} />
        </div>
    );
}

// ============================================================
// Empty State
// ============================================================

interface EmptyStateProps {
    firstSnapshotDate: string | null;
}

function EmptyState({ firstSnapshotDate }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <BarChart3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
                No historical data yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                {firstSnapshotDate
                    ? `Data recording started on ${new Date(firstSnapshotDate).toLocaleDateString()}. Keep syncing to build your performance history.`
                    : "Sync your portfolio to start recording performance data. Historical data will accumulate over time."}
            </p>
        </div>
    );
}

// ============================================================
// Main Component
// ============================================================

export function PortfolioPerformanceChart({
    className,
    height = 200,
}: PortfolioPerformanceChartProps) {
    const {
        data,
        summary,
        loading,
        error,
        period,
        setPeriod,
        refresh,
        hasRealData,
        firstSnapshotDate,
    } = usePortfolioHistory();

    // Fetch data when period changes
    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period]);

    // Determine chart color based on P&L
    const chartColor = useMemo(() => {
        if (!summary) return { stroke: "#6b7280", fill: "#6b7280" };
        return summary.totalPnL >= 0
            ? { stroke: "#10b981", fill: "#10b981" }
            : { stroke: "#ef4444", fill: "#ef4444" };
    }, [summary]);

    // Y-axis domain with padding
    const yDomain = useMemo(() => {
        if (data.length === 0) return [0, 100];
        const values = data.map((d) => d.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const padding = (max - min) * 0.1 || max * 0.1;
        return [Math.max(0, min - padding), max + padding];
    }, [data]);

    // Format Y-axis tick
    const formatYAxis = (value: number) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toFixed(0);
    };

    if (loading && data.length === 0) {
        return (
            <div className={cn("rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-primary/10 p-4", className)}>
                <ChartSkeleton height={height} />
            </div>
        );
    }

    return (
        <div
            className={cn(
                "rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-primary/10 p-4",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    {summary ? (
                        <SummaryStats summary={summary} period={period} />
                    ) : (
                        <div className="flex flex-col gap-1">
                            <span className="text-lg font-semibold text-foreground">Performance</span>
                            <span className="text-xs text-muted-foreground">Portfolio value over time</span>
                        </div>
                    )}
                </div>

                {/* Period Selector */}
                <div className="flex items-center gap-1">
                    {PERIOD_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setPeriod(opt.value)}
                            disabled={loading}
                            className={cn(
                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                period === opt.value
                                    ? "bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                                loading && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 ml-1"
                        onClick={refresh}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="flex items-center justify-center h-32 text-sm text-red-500">
                    {error}
                </div>
            )}

            {/* Empty State - No Data */}
            {!error && !loading && data.length === 0 && (
                <EmptyState firstSnapshotDate={firstSnapshotDate} />
            )}

            {/* Chart */}
            {!error && data.length > 0 && (
                <>
                    <div style={{ height }} className="relative">
                        {loading && (
                            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
                                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={data}
                                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
                            >
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={chartColor.fill} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={chartColor.fill} stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <XAxis
                                    dataKey="displayDate"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                                    interval="preserveStartEnd"
                                    minTickGap={50}
                                />

                                <YAxis
                                    domain={yDomain}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                                    tickFormatter={formatYAxis}
                                    width={45}
                                />

                                <Tooltip content={<CustomTooltip />} />

                                {/* Reference line at start value */}
                                {summary && (
                                    <ReferenceLine
                                        y={summary.startValue}
                                        stroke="#6b7280"
                                        strokeDasharray="3 3"
                                        strokeOpacity={0.5}
                                    />
                                )}

                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={chartColor.stroke}
                                    strokeWidth={2}
                                    fill="url(#chartGradient)"
                                    animationDuration={500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Data Info */}
                    {hasRealData && firstSnapshotDate && (
                        <div className="mt-3 pt-3 border-t border-border-light dark:border-white/5">
                            <TooltipProvider>
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 cursor-help">
                                            <Info className="w-3 h-3" />
                                            <span>
                                                Data since {new Date(firstSnapshotDate).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                        <p className="text-xs">
                                            This chart shows your actual portfolio performance recorded since {new Date(firstSnapshotDate).toLocaleDateString()}.
                                            Data is recorded automatically when you sync your portfolio.
                                        </p>
                                    </TooltipContent>
                                </UITooltip>
                            </TooltipProvider>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
