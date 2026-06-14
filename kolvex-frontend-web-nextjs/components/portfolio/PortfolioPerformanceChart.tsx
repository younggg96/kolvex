"use client";

import React, { useMemo, useState } from "react";
import {
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ComposedChart,
} from "recharts";
import { TrendingUp, TrendingDown, BarChart3, RefreshCw, Info, DollarSign, Activity, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency, formatPercent } from "@/lib/portfolioApi";
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
    /** User ID to fetch history for */
    userId?: string;
    /** Whether the current user is the owner of this portfolio */
    isOwner?: boolean;
}

type ChartView = "combined" | "value" | "pnl";

// ============================================================
// Period Options (minimum 1W, daily data)
// ============================================================

const PERIOD_OPTIONS: { value: PerformancePeriod; label: string }[] = [
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
        dataKey: string;
    }>;
    chartView: ChartView;
    isOwner: boolean;
    t: (key: string, params?: Record<string, string>) => string;
}

function CustomTooltip({ active, payload, chartView, isOwner, t }: CustomTooltipProps) {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const isPositive = data.pnlPercent >= 0;

    return (
        <div className="bg-card-dark/95 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl min-w-[160px]">
            <p className="text-xs text-gray-400 mb-2 border-b border-white/10 pb-1.5">
                {data.displayDate}
            </p>

            {/* Portfolio Value - Only show for owner */}
            {isOwner && (chartView === "combined" || chartView === "value") && (
                <div className="flex items-center justify-between gap-4 mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-xs text-gray-400">{t("portfolio.table.value")}</span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                        {formatCurrency(data.value)}
                    </span>
                </div>
            )}

            {/* P&L Amount - Only show for owner */}
            {isOwner && (chartView === "combined" || chartView === "pnl") && (
                <div className="flex items-center justify-between gap-4 mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            isPositive ? "bg-emerald-500" : "bg-red-500"
                        )} />
                        <span className="text-xs text-gray-400">{t("portfolio.performance.pnl")}</span>
                    </div>
                    <span className={cn(
                        "text-sm font-medium",
                        isPositive ? "text-emerald-400" : "text-red-400"
                    )}>
                        {isPositive ? "+" : ""}{formatCurrency(data.pnl)}
                    </span>
                </div>
            )}

            {chartView !== "value" && (
                <div className={cn(
                    "flex items-center justify-between gap-4",
                    isOwner && "mt-1.5 pt-1.5 border-t border-white/5"
                )}>
                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            isPositive ? "bg-emerald-500" : "bg-red-500"
                        )} />
                        <span className="text-xs text-gray-400">{t("portfolio.performance.pnlPercent")}</span>
                    </div>
                    <span className={cn(
                        "text-sm font-semibold",
                        isPositive ? "text-emerald-400" : "text-red-400"
                    )}>
                        {formatPercent(data.pnlPercent)}
                    </span>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Summary Stats
// ============================================================

interface SummaryStatsProps {
    summary: PerformanceSummary;
    period: PerformancePeriod;
    chartView: ChartView;
    isOwner: boolean;
    t: (key: string, params?: Record<string, string>) => string;
}

function SummaryStats({ summary, period, chartView, isOwner, t }: SummaryStatsProps) {
    const showingValueOnly = chartView === "value";
    const primaryChange = showingValueOnly ? summary.valueChange : summary.totalPnL;
    const primaryPercent = showingValueOnly
        ? summary.valueChangePercent
        : summary.totalPnLPercent;
    const isPositive = primaryChange >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;

    const periodLabel = period === "YTD"
        ? t("portfolio.performance.yearToDate")
        : period === "ALL"
            ? t("portfolio.performance.allTime")
            : t("portfolio.performance.pastPeriod", {
                period: period === "1W" ? "1 week" : period === "1M" ? "1 month" : "3 months",
            });

    return (
        <div className="flex flex-col gap-2">
            {isOwner && chartView !== "pnl" && (
                <span className="text-xl font-bold text-foreground">
                    {formatCurrency(summary.endValue)}
                </span>
            )}

            <div className="flex items-center gap-2">
                <Icon
                    className={cn(
                        "w-4 h-4",
                        isPositive ? "text-emerald-500" : "text-red-500"
                    )}
                />
                {/* P&L Amount - Only show for owner */}
                {isOwner && (
                    <span
                        className={cn(
                            "text-lg font-semibold",
                            isPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                        )}
                    >
                        {isPositive ? "+" : ""}{formatCurrency(primaryChange)}
                    </span>
                )}
                {/* P&L Percent - Show for everyone */}
                <span
                    className={cn(
                        isOwner ? "text-sm font-medium" : "text-xl font-bold",
                        isPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                    )}
                >
                    {isOwner ? "(" : ""}{formatPercent(primaryPercent)}{isOwner ? ")" : ""}
                </span>
            </div>

            <span className="text-xs text-muted-foreground">
                {showingValueOnly
                    ? `${t("portfolio.performance.valueChange")} · ${periodLabel}`
                    : t("portfolio.performance.currentUnrealizedPnl")}
            </span>
        </div>
    );
}

// ============================================================
// Chart View Toggle
// ============================================================

interface ChartViewToggleProps {
    chartView: ChartView;
    setChartView: (view: ChartView) => void;
    isOwner: boolean;
    t: (key: string, params?: Record<string, string>) => string;
}

function ChartViewToggle({ chartView, setChartView, isOwner, t }: ChartViewToggleProps) {
    // For non-owner, only show percent view
    const views: { value: ChartView; label: string; icon: React.ReactNode }[] = isOwner
        ? [
            { value: "combined", label: t("portfolio.performance.both"), icon: <Activity className="w-3 h-3" /> },
            { value: "value", label: t("portfolio.table.value"), icon: <DollarSign className="w-3 h-3" /> },
            { value: "pnl", label: t("portfolio.performance.pnl"), icon: <TrendingUp className="w-3 h-3" /> },
        ]
        : [
            { value: "pnl", label: t("portfolio.performance.performanceLabel"), icon: <Percent className="w-3 h-3" /> },
        ];

    // If only one view available, don't show toggle
    if (views.length === 1) {
        return null;
    }

    return (
        <div className="flex items-center gap-0.5 bg-muted/30 rounded-md p-0.5">
            {views.map((view) => (
                <button
                    key={view.value}
                    onClick={() => setChartView(view.value)}
                    className={cn(
                        "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-all",
                        chartView === view.value
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {view.icon}
                    <span className="hidden sm:inline">{view.label}</span>
                </button>
            ))}
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
    isOwner: boolean;
    t: (key: string, params?: Record<string, string>) => string;
}

function EmptyState({ firstSnapshotDate, isOwner, t }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <BarChart3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
                {t("portfolio.performance.noDataYet")}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                {isOwner
                    ? (firstSnapshotDate
                        ? t("portfolio.performance.ownerNoDataStarted", { date: new Date(firstSnapshotDate).toLocaleDateString() })
                        : t("portfolio.performance.ownerNoData"))
                    : t("portfolio.performance.publicNoData")
                }
            </p>
        </div>
    );
}

// ============================================================
// Main Component
// ============================================================

export function PortfolioPerformanceChart({
    className,
    height = 300,
    userId,
    isOwner = false,
}: PortfolioPerformanceChartProps) {
    const { t } = useTranslation();
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
    } = usePortfolioHistory({ userId });

    const [chartView, setChartView] = useState<ChartView>("pnl");

    // P&L color based on overall performance
    const pnlColor = useMemo(() => {
        if (!summary) return { stroke: "#6b7280", fill: "#6b7280" };
        return summary.totalPnL >= 0
            ? { stroke: "#10b981", fill: "#10b981" }
            : { stroke: "#ef4444", fill: "#ef4444" };
    }, [summary]);

    const valueColor = { stroke: "#3b82f6", fill: "#3b82f6" };

    // Y-axis domain for value
    const valueDomain = useMemo(() => {
        if (data.length === 0) return [0, 100];
        const values = data.map((d) => d.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const padding = (max - min) * 0.15 || max * 0.1;
        return [Math.max(0, min - padding), max + padding];
    }, [data]);

    // Y-axis domain for P&L percent (for non-owner)
    const pnlPercentDomain = useMemo(() => {
        if (data.length === 0) return [-10, 10];
        const pnlValues = data.map((d) => d.pnlPercent);
        const min = Math.min(...pnlValues);
        const max = Math.max(...pnlValues);
        const absMax = Math.max(Math.abs(min), Math.abs(max));
        const padding = absMax * 0.15 || 10;
        return [min - padding, max + padding];
    }, [data]);

    // Y-axis domain for P&L amount (for owner)
    const pnlDomain = useMemo(() => {
        if (data.length === 0) return [-100, 100];
        const pnlValues = data.map((d) => d.pnl);
        const min = Math.min(...pnlValues);
        const max = Math.max(...pnlValues);
        const absMax = Math.max(Math.abs(min), Math.abs(max));
        const padding = absMax * 0.15 || 100;
        return [min - padding, max + padding];
    }, [data]);

    // Format Y-axis tick for value
    const formatValueAxis = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
    };

    // Format Y-axis tick for P&L amount
    const formatPnlAxis = (value: number) => {
        const sign = value >= 0 ? "+" : "";
        if (Math.abs(value) >= 1000000) return `${sign}${(value / 1000000).toFixed(1)}M`;
        if (Math.abs(value) >= 1000) return `${sign}${(value / 1000).toFixed(0)}K`;
        return `${sign}${value.toFixed(0)}`;
    };

    // Format Y-axis tick for P&L percent
    const formatPnlPercentAxis = (value: number) => {
        const sign = value >= 0 ? "+" : "";
        return `${sign}${value.toFixed(1)}%`;
    };

    if (loading && data.length === 0) {
        return (
            <div className={cn("rounded-xl bg-card border border-border p-4", className)}>
                <ChartSkeleton height={height} />
            </div>
        );
    }

    // Determine which Y-axis and data to use based on isOwner and chartView
    const showValueChart = isOwner && (chartView === "combined" || chartView === "value");
    const showPnlChart = chartView === "combined" || chartView === "pnl";

    return (
        <div
            className={cn(
                "rounded-xl bg-card border border-border p-4",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                    {summary ? (
                        <SummaryStats
                            summary={summary}
                            period={period}
                            chartView={chartView}
                            isOwner={isOwner}
                            t={t}
                        />
                    ) : (
                        <div className="flex flex-col gap-1">
                            <span className="text-lg font-semibold text-foreground">{t("portfolio.performance.title")}</span>
                            <span className="text-xs text-muted-foreground">
                                {isOwner ? t("portfolio.performance.valueAndPnl") : t("portfolio.performance.performanceOverTime")}
                            </span>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex flex-col items-end gap-2">
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

                    {/* Chart View Toggle - Only show for owner */}
                    <ChartViewToggle chartView={chartView} setChartView={setChartView} isOwner={isOwner} t={t} />
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
                <EmptyState firstSnapshotDate={firstSnapshotDate} isOwner={isOwner} t={t} />
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
                            <ComposedChart
                                data={data}
                                margin={{
                                    top: 10,
                                    right: isOwner && chartView === "combined" ? 50 : 10,
                                    left: 0,
                                    bottom: 5
                                }}
                            >
                                <defs>
                                    {/* Value gradient (blue) */}
                                    <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={valueColor.fill} stopOpacity={0.25} />
                                        <stop offset="100%" stopColor={valueColor.fill} stopOpacity={0} />
                                    </linearGradient>
                                    {/* P&L gradient (green/red based on performance) */}
                                    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={pnlColor.fill} stopOpacity={0.2} />
                                        <stop offset="100%" stopColor={pnlColor.fill} stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <XAxis
                                    dataKey="displayDate"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                                    interval="preserveStartEnd"
                                    minTickGap={60}
                                />

                                {/* Left Y-axis: Portfolio Value (only for owner, combined & value views) */}
                                {showValueChart && (
                                    <YAxis
                                        yAxisId="value"
                                        orientation="left"
                                        domain={valueDomain}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: "#3b82f6" }}
                                        tickFormatter={formatValueAxis}
                                        width={55}
                                    />
                                )}

                                {/* Y-axis: P&L - different format based on owner */}
                                {showPnlChart && (
                                    <YAxis
                                        yAxisId="pnl"
                                        orientation={isOwner && chartView === "combined" ? "right" : "left"}
                                        domain={isOwner ? pnlDomain : pnlPercentDomain}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{
                                            fontSize: 10,
                                            fill: summary && summary.totalPnL >= 0 ? "#10b981" : "#ef4444"
                                        }}
                                        tickFormatter={isOwner ? formatPnlAxis : formatPnlPercentAxis}
                                        width={55}
                                    />
                                )}

                                <Tooltip content={<CustomTooltip chartView={chartView} isOwner={isOwner} t={t} />} />

                                {/* Reference line at zero for P&L */}
                                {showPnlChart && (
                                    <ReferenceLine
                                        yAxisId="pnl"
                                        y={0}
                                        stroke="#6b7280"
                                        strokeDasharray="3 3"
                                        strokeOpacity={0.5}
                                    />
                                )}

                                {/* Reference line at start value (only for owner) */}
                                {showValueChart && summary && (
                                    <ReferenceLine
                                        yAxisId="value"
                                        y={summary.startValue}
                                        stroke="#3b82f6"
                                        strokeDasharray="3 3"
                                        strokeOpacity={0.3}
                                    />
                                )}

                                {/* Portfolio Value Area (only for owner) */}
                                {showValueChart && (
                                    <Area
                                        yAxisId="value"
                                        type="monotone"
                                        dataKey="value"
                                        stroke={valueColor.stroke}
                                        strokeWidth={2}
                                        fill="url(#valueGradient)"
                                        animationDuration={500}
                                        name={t("portfolio.performance.portfolioValue")}
                                    />
                                )}

                                {/* P&L Area - use pnlPercent for non-owner, pnl for owner */}
                                {showPnlChart && (
                                    <Area
                                        yAxisId="pnl"
                                        type="monotone"
                                        dataKey={isOwner ? "pnl" : "pnlPercent"}
                                        stroke={pnlColor.stroke}
                                        strokeWidth={2}
                                        fill="url(#pnlGradient)"
                                        animationDuration={500}
                                        name={isOwner ? t("portfolio.performance.pnl") : t("portfolio.performance.performanceLabel")}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend - only for owner with combined view */}
                    {isOwner && chartView === "combined" && (
                        <div className="flex items-center justify-center gap-6 mt-2">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0.5 bg-blue-500 rounded" />
                                <span className="text-xs text-muted-foreground">{t("portfolio.performance.portfolioValue")}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className={cn(
                                    "w-3 h-0.5 rounded",
                                    summary && summary.totalPnL >= 0 ? "bg-emerald-500" : "bg-red-500"
                                )} />
                                <span className="text-xs text-muted-foreground">{t("portfolio.performance.pnl")}</span>
                            </div>
                        </div>
                    )}

                    {/* Data Info */}
                    {hasRealData && firstSnapshotDate && (
                        <div className="mt-3 pt-3 border-t border-border">
                            <TooltipProvider>
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 cursor-help">
                                            <Info className="w-3 h-3" />
                                            <span>
                                                {t("portfolio.performance.dataSince", { date: new Date(firstSnapshotDate).toLocaleDateString() })}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                        <p className="text-xs">
                                            {isOwner
                                                ? t("portfolio.performance.ownerDataTooltip", { date: new Date(firstSnapshotDate).toLocaleDateString() })
                                                : t("portfolio.performance.publicDataTooltip", { date: new Date(firstSnapshotDate).toLocaleDateString() })
                                            }
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
