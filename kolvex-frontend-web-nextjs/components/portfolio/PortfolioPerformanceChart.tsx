"use client";

import React, { useMemo, useState } from "react";
import {
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    YAxis,
} from "recharts";
import { Info, RefreshCw } from "lucide-react";
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
} from "./hooks/usePortfolioHistory";

interface PortfolioPerformanceChartProps {
    className?: string;
    height?: number;
    /** User ID to fetch history for */
    userId?: string;
    /** Whether the current user is the owner of this portfolio */
    isOwner?: boolean;
    /** Live figures shown in the headline when the chart is not being scrubbed */
    liveValue?: number | string;
    livePnL?: number | string;
    livePnlPercent?: number | string;
}

type ChartView = "value" | "pnl";

const PERIOD_OPTIONS: PerformancePeriod[] = ["1W", "1M", "3M", "YTD", "ALL"];

const POSITIVE = "rgb(var(--positive-fill))";
const NEGATIVE = "rgb(var(--negative-fill))";

const isNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

function signedCurrency(value: number) {
    return `${value >= 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
}

export function PortfolioPerformanceChart({
    className,
    height = 260,
    userId,
    isOwner = false,
    liveValue,
    livePnL,
    livePnlPercent,
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

    const [chartView, setChartView] = useState<ChartView>(isOwner ? "value" : "pnl");
    const [active, setActive] = useState<PerformanceDataPoint | null>(null);
    const dataKey = chartView === "value" && isOwner ? "value" : isOwner ? "pnl" : "pnlPercent";

    const periodChange = useMemo(() => {
        if (!summary) return null;
        return chartView === "value"
            ? { amount: summary.valueChange, percent: summary.valueChangePercent }
            : { amount: summary.totalPnL, percent: summary.totalPnLPercent };
    }, [summary, chartView]);

    const trendPositive = active
        ? (chartView === "value" && data.length
            ? active.value >= data[0].value
            : active.pnl >= 0)
        : (periodChange?.amount ?? 0) >= 0;
    const stroke = trendPositive ? POSITIVE : NEGATIVE;

    const domain = useMemo(() => {
        if (data.length === 0) return [0, 1];
        const values = data.map((d) => Number(d[dataKey as keyof PerformanceDataPoint]));
        const min = Math.min(...values);
        const max = Math.max(...values);
        const pad = (max - min) * 0.12 || Math.abs(max) * 0.05 || 1;
        return [min - pad, max + pad];
    }, [data, dataKey]);

    const periodLabel =
        period === "YTD"
            ? t("portfolio.performance.yearToDate")
            : period === "ALL"
                ? t("portfolio.performance.allTime")
                : t(`portfolio.performance.past${period}`);

    // Headline: the scrubbed point, otherwise live figures, otherwise the latest snapshot.
    const headlineValue = active
        ? active.value
        : isNumber(liveValue)
            ? liveValue
            : summary?.endValue;
    const headlineChange = active
        ? chartView === "value" && data.length
            ? {
                amount: active.value - data[0].value,
                percent: data[0].value ? ((active.value - data[0].value) / data[0].value) * 100 : 0,
            }
            : { amount: active.pnl, percent: active.pnlPercent }
        : chartView === "pnl" && isNumber(livePnL) && isNumber(livePnlPercent)
            ? { amount: livePnL, percent: livePnlPercent }
            : periodChange;
    const changeCaption = active
        ? active.displayDate
        : chartView === "value"
            ? periodLabel
            : t("portfolio.performance.currentUnrealizedPnl");
    const changePositive = (headlineChange?.amount ?? 0) >= 0;

    return (
        <section className={cn("min-w-0", className)} aria-label={t("portfolio.performance.title")}>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0" aria-live="polite">
                    {isOwner ? (
                        <p className="figure text-[34px] font-semibold leading-tight sm:text-[40px]">
                            {liveValue === "***" ? "***" : isNumber(headlineValue) ? formatCurrency(headlineValue) : "—"}
                        </p>
                    ) : (
                        <p className={cn("figure text-[34px] font-semibold leading-tight sm:text-[40px]", changePositive ? "text-positive" : "text-negative")}>
                            {headlineChange ? formatPercent(headlineChange.percent) : "—"}
                        </p>
                    )}
                    {headlineChange && (
                        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className={cn("figure font-semibold", changePositive ? "text-positive" : "text-negative")}>
                                {isOwner && `${signedCurrency(headlineChange.amount)} `}
                                {isOwner ? `(${formatPercent(headlineChange.percent)})` : ""}
                            </span>
                            <span className="text-muted-foreground">{changeCaption}</span>
                        </p>
                    )}
                </div>
                {isOwner && (
                    <div role="radiogroup" aria-label={t("portfolio.performance.title")} className="flex items-center gap-1 rounded-full bg-muted p-1">
                        {(["value", "pnl"] as ChartView[]).map((view) => (
                            <button
                                key={view}
                                type="button"
                                role="radio"
                                aria-checked={chartView === view}
                                onClick={() => setChartView(view)}
                                className={cn(
                                    "h-7 rounded-full px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                    chartView === view
                                        ? "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {view === "value" ? t("portfolio.performance.portfolioValue") : t("portfolio.performance.pnl")}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative mt-5" style={{ height }}>
                {loading && data.length === 0 ? (
                    <Skeleton className="h-full w-full" />
                ) : error ? (
                    <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                        <span>{error}</span>
                        <Button size="sm" variant="outline" onClick={refresh}>
                            {t("common.retry")}
                        </Button>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center border-y border-dashed border-border px-4 text-center">
                        <p className="text-sm font-semibold">{t("portfolio.performance.noDataYet")}</p>
                        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                            {isOwner
                                ? firstSnapshotDate
                                    ? t("portfolio.performance.ownerNoDataStarted", { date: new Date(firstSnapshotDate).toLocaleDateString() })
                                    : t("portfolio.performance.ownerNoData")
                                : t("portfolio.performance.publicNoData")}
                        </p>
                    </div>
                ) : (
                    <>
                        {loading && (
                            <div className="absolute right-0 top-0 z-10">
                                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={data}
                                margin={{ top: 8, right: 4, left: 4, bottom: 8 }}
                                onMouseMove={(state) => {
                                    const point = state?.activePayload?.[0]?.payload as PerformanceDataPoint | undefined;
                                    setActive(point ?? null);
                                }}
                                onMouseLeave={() => setActive(null)}
                            >
                                <YAxis hide domain={domain} />
                                <Tooltip
                                    content={() => null}
                                    cursor={{ stroke: "rgb(var(--foreground) / 0.25)", strokeWidth: 1 }}
                                    isAnimationActive={false}
                                />
                                {chartView === "value" && isOwner && data.length > 0 && (
                                    <ReferenceLine
                                        y={data[0].value}
                                        stroke="rgb(var(--foreground) / 0.18)"
                                        strokeDasharray="2 5"
                                    />
                                )}
                                {chartView === "pnl" && (
                                    <ReferenceLine y={0} stroke="rgb(var(--foreground) / 0.18)" strokeDasharray="2 5" />
                                )}
                                <Line
                                    type="linear"
                                    dataKey={dataKey}
                                    stroke={stroke}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4.5, fill: stroke, stroke: "rgb(var(--background))", strokeWidth: 3 }}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </>
                )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-b border-border pb-4">
                <div role="radiogroup" aria-label={t("portfolio.performance.period")} className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                    {PERIOD_OPTIONS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={period === value}
                            onClick={() => setPeriod(value)}
                            disabled={loading}
                            className={cn(
                                "inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                                period === value
                                    ? "bg-foreground text-background"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                        >
                            {t(`portfolio.performance.periods.${value}`)}
                        </button>
                    ))}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {hasRealData && firstSnapshotDate && (
                        <TooltipProvider>
                            <UITooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label={t("portfolio.performance.dataSince", { date: new Date(firstSnapshotDate).toLocaleDateString() })}
                                    >
                                        <Info className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                    {isOwner
                                        ? t("portfolio.performance.ownerDataTooltip", { date: new Date(firstSnapshotDate).toLocaleDateString() })
                                        : t("portfolio.performance.publicDataTooltip", { date: new Date(firstSnapshotDate).toLocaleDateString() })}
                                </TooltipContent>
                            </UITooltip>
                        </TooltipProvider>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={refresh}
                        disabled={loading}
                        aria-label={t("portfolio.performance.refreshChart")}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>
        </section>
    );
}
