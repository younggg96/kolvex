"use client";

import { useState, useEffect, useMemo } from "react";
import { KOLTweet } from "@/lib/kolTweetsApi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Zap,
  MessageSquare,
  Percent,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/EmptyState";

// ============================================================
// Types
// ============================================================

interface StockPrediction {
  ticker: string;
  sentiment: "bullish" | "bearish" | "neutral";
  tweetId: number;
  tweetText: string;
  predictedAt: string;
  confidence: number | null;
}

interface StockPerformance {
  ticker: string;
  predictions: StockPrediction[];
  currentPrice?: number;
  priceChange7d?: number;
  priceChange30d?: number;
  isMatch?: boolean | null;
}

interface KOLAnalysisPanelProps {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  tweets: KOLTweet[];
  isLoading?: boolean;
}

// ============================================================
// Helper Functions
// ============================================================

function calculateStats(performances: StockPerformance[]) {
  const evaluated = performances.filter((p) => p.isMatch !== null);
  const correct = evaluated.filter((p) => p.isMatch === true).length;
  const total = evaluated.length;
  const totalMentions = performances.reduce(
    (sum, p) => sum + p.predictions.length,
    0
  );
  const avgConfidence =
    performances.reduce((sum, p) => {
      const predConfidences = p.predictions
        .filter((pred) => pred.confidence !== null)
        .map((pred) => pred.confidence!);
      return (
        sum +
        (predConfidences.length > 0
          ? predConfidences.reduce((a, b) => a + b, 0) / predConfidences.length
          : 0)
      );
    }, 0) / (performances.length || 1);

  const bullishCount = performances.filter((p) => {
    const bullish = p.predictions.filter(
      (pred) => pred.sentiment === "bullish"
    ).length;
    const bearish = p.predictions.filter(
      (pred) => pred.sentiment === "bearish"
    ).length;
    return bullish > bearish;
  }).length;

  return {
    accuracy: total > 0 ? (correct / total) * 100 : null,
    correct,
    total,
    totalStocks: performances.length,
    totalMentions,
    avgConfidence: avgConfidence * 100,
    bullishRatio:
      performances.length > 0 ? (bullishCount / performances.length) * 100 : 0,
  };
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Today";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

// ============================================================
// Sub Components
// ============================================================

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  colorClass?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="!p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              colorClass || "bg-primary/10 text-primary"
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          {subValue && (
            <span className="text-xs text-muted-foreground">{subValue}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AccuracyRing({ percentage }: { percentage: number | null }) {
  const radius = 36;
  const stroke = 5;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    percentage !== null
      ? circumference - (percentage / 100) * circumference
      : circumference;

  const getColor = (pct: number | null) => {
    if (pct === null) return "text-muted-foreground";
    if (pct >= 70) return "text-green-500";
    if (pct >= 50) return "text-amber-500";
    return "text-red-500";
  };

  const getBgColor = (pct: number | null) => {
    if (pct === null) return "bg-gray-50 dark:bg-white/5";
    if (pct >= 70) return "bg-green-50 dark:bg-green-500/10";
    if (pct >= 50) return "bg-amber-50 dark:bg-amber-500/10";
    return "bg-red-50 dark:bg-red-500/10";
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full p-2",
        getBgColor(percentage)
      )}
    >
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        {/* Background ring */}
        <circle
          stroke="currentColor"
          className="text-gray-200 dark:text-white/10"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress ring */}
        <circle
          stroke="currentColor"
          className={cn("transition-all duration-700", getColor(percentage))}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference + " " + circumference}
          style={{ strokeDashoffset }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn("text-lg font-bold tabular-nums", getColor(percentage))}
        >
          {percentage !== null ? `${percentage.toFixed(0)}%` : "—"}
        </span>
      </div>
    </div>
  );
}

function StockRow({
  performance,
  onSelect,
  isSelected,
}: {
  performance: StockPerformance;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const bullishCount = performance.predictions.filter(
    (p) => p.sentiment === "bullish"
  ).length;
  const bearishCount = performance.predictions.filter(
    (p) => p.sentiment === "bearish"
  ).length;
  const overallSentiment =
    bullishCount > bearishCount
      ? "bullish"
      : bearishCount > bullishCount
      ? "bearish"
      : "neutral";

  const latestDate = performance.predictions[0]?.predictedAt;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
        "border",
        isSelected
          ? "bg-primary/5 dark:bg-primary/10 border-primary/30 dark:border-primary/30"
          : "border-gray-100 dark:border-white/5 hover:border-primary/20 dark:hover:border-primary/20 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
      )}
    >
      {/* Ticker */}
      <Link
        href={`/dashboard/stock/${performance.ticker}`}
        onClick={(e) => e.stopPropagation()}
        className="min-w-[52px]"
      >
        <span className="font-mono font-bold text-sm text-gray-900 dark:text-white hover:text-primary transition-colors">
          ${performance.ticker}
        </span>
      </Link>

      {/* Sentiment Badge */}
      <div className="flex-shrink-0">
        {overallSentiment === "bullish" ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10">
            <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
              Bull
            </span>
          </div>
        ) : overallSentiment === "bearish" ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10">
            <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
              Bear
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5">
            <Minus className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Neut
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex-1 flex items-center gap-2 text-xs text-gray-500 dark:text-white/50">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {performance.predictions.length}
        </span>
        {latestDate && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(latestDate)}
          </span>
        )}
      </div>

      {/* Price Change */}
      {performance.priceChange7d !== undefined && (
        <div
          className={cn(
            "text-xs font-medium tabular-nums px-1.5 py-0.5 rounded",
            performance.priceChange7d >= 0
              ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10"
              : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
          )}
        >
          {performance.priceChange7d >= 0 ? "+" : ""}
          {performance.priceChange7d.toFixed(1)}%
        </div>
      )}

      {/* Match Status */}
      <div className="flex-shrink-0">
        {performance.isMatch === true ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : performance.isMatch === false ? (
          <XCircle className="w-4 h-4 text-red-500" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 dark:border-white/20" />
        )}
      </div>

      {/* Arrow */}
      <ChevronRight
        className={cn(
          "w-4 h-4 text-gray-400 dark:text-white/40 transition-transform",
          isSelected && "rotate-90"
        )}
      />
    </div>
  );
}

function StockDetail({ performance }: { performance: StockPerformance }) {
  const bullishCount = performance.predictions.filter(
    (p) => p.sentiment === "bullish"
  ).length;
  const bearishCount = performance.predictions.filter(
    (p) => p.sentiment === "bearish"
  ).length;
  const neutralCount =
    performance.predictions.length - bullishCount - bearishCount;

  return (
    <div className="mt-2 ml-4 p-4 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 space-y-4">
      {/* Sentiment Distribution */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/50 font-medium mb-2">
          Sentiment Distribution
        </p>
        <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-white/10">
          {bullishCount > 0 && (
            <div
              className="bg-green-500 transition-all rounded-l-full"
              style={{
                width: `${
                  (bullishCount / performance.predictions.length) * 100
                }%`,
              }}
            />
          )}
          {neutralCount > 0 && (
            <div
              className="bg-gray-400 transition-all"
              style={{
                width: `${
                  (neutralCount / performance.predictions.length) * 100
                }%`,
              }}
            />
          )}
          {bearishCount > 0 && (
            <div
              className="bg-red-500 transition-all rounded-r-full"
              style={{
                width: `${
                  (bearishCount / performance.predictions.length) * 100
                }%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between mt-2 text-[10px]">
          <span className="text-green-600 dark:text-green-400 font-medium">
            {bullishCount} Bullish
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {neutralCount} Neutral
          </span>
          <span className="text-red-600 dark:text-red-400 font-medium">
            {bearishCount} Bearish
          </span>
        </div>
      </div>

      {/* Recent Mentions */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/50 font-medium mb-2">
          Recent Mentions
        </p>
        <div className="space-y-2">
          {performance.predictions.slice(0, 3).map((pred) => (
            <div
              key={pred.tweetId}
              className="flex gap-2 p-2.5 rounded-lg bg-white dark:bg-black/20 border border-gray-100 dark:border-white/5"
            >
              <div className="mt-0.5 flex-shrink-0">
                {pred.sentiment === "bullish" ? (
                  <div className="w-5 h-5 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                  </div>
                ) : pred.sentiment === "bearish" ? (
                  <div className="w-5 h-5 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                    <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                    <Minus className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 dark:text-white/80 line-clamp-2 leading-relaxed">
                  {pred.tweetText.length > 120
                    ? pred.tweetText.slice(0, 120) + "..."
                    : pred.tweetText}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-400 dark:text-white/40">
                    {formatTimeAgo(pred.predictedAt)}
                  </span>
                  {pred.confidence && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50"
                    >
                      {Math.round(pred.confidence * 100)}% conf
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {performance.predictions.length > 3 && (
          <p className="text-[10px] text-center text-gray-400 dark:text-white/40 mt-3">
            +{performance.predictions.length - 3} more mentions
          </p>
        )}
      </div>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="p-2 space-y-4">
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      {/* Stock List Skeleton */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function KOLAnalysisPanel({
  tweets,
  isLoading = false,
}: KOLAnalysisPanelProps) {
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [stockPrices, setStockPrices] = useState<
    Record<string, { change7d: number; change30d: number }>
  >({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // Extract stock predictions from tweets
  const stockPerformances = useMemo(() => {
    const stockMap = new Map<string, StockPrediction[]>();

    tweets.forEach((tweet) => {
      if (!tweet.tickers || tweet.tickers.length === 0) return;
      if (!tweet.sentiment?.value) return;

      tweet.tickers.forEach((ticker) => {
        const prediction: StockPrediction = {
          ticker: ticker.toUpperCase(),
          sentiment: tweet.sentiment!.value as
            | "bullish"
            | "bearish"
            | "neutral",
          tweetId: tweet.id,
          tweetText: tweet.tweet_text,
          predictedAt: tweet.created_at || "",
          confidence: tweet.sentiment?.confidence || null,
        };

        const existing = stockMap.get(ticker.toUpperCase()) || [];
        existing.push(prediction);
        stockMap.set(ticker.toUpperCase(), existing);
      });
    });

    const performances: StockPerformance[] = Array.from(stockMap.entries())
      .map(([ticker, predictions]) => {
        predictions.sort((a, b) => {
          if (!a.predictedAt || !b.predictedAt) return 0;
          return (
            new Date(b.predictedAt).getTime() -
            new Date(a.predictedAt).getTime()
          );
        });

        const priceData = stockPrices[ticker];
        const latestSentiment = predictions[0]?.sentiment;

        let isMatch: boolean | null = null;
        if (priceData && latestSentiment !== "neutral") {
          const priceDirection =
            priceData.change7d >= 0 ? "bullish" : "bearish";
          isMatch = priceDirection === latestSentiment;
        }

        return {
          ticker,
          predictions,
          priceChange7d: priceData?.change7d,
          priceChange30d: priceData?.change30d,
          isMatch,
        };
      })
      .sort((a, b) => b.predictions.length - a.predictions.length);

    return performances;
  }, [tweets, stockPrices]);

  // Fetch stock prices
  useEffect(() => {
    const tickers = stockPerformances.map((p) => p.ticker);
    if (tickers.length === 0) return;

    const fetchPrices = async () => {
      setIsLoadingPrices(true);
      try {
        const tickersToFetch = tickers.slice(0, 15);
        const pricePromises = tickersToFetch.map(async (ticker) => {
          try {
            const res = await fetch(`/api/stocks/quote?symbol=${ticker}`);
            if (!res.ok) return { ticker, data: null };
            const data = await res.json();
            return {
              ticker,
              data: {
                change7d: data.regularMarketChangePercent || 0,
                change30d: data.regularMarketChangePercent || 0,
              },
            };
          } catch {
            return { ticker, data: null };
          }
        });

        const results = await Promise.all(pricePromises);
        const priceMap: Record<
          string,
          { change7d: number; change30d: number }
        > = {};
        results.forEach(({ ticker, data }) => {
          if (data) priceMap[ticker] = data;
        });
        setStockPrices(priceMap);
      } catch (error) {
        console.error("Failed to fetch stock prices:", error);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchPrices();
  }, [stockPerformances.length]);

  const stats = calculateStats(stockPerformances);
  const selectedPerformance = stockPerformances.find(
    (p) => p.ticker === selectedStock
  );

  if (isLoading) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <div className="flex-shrink-0 p-2 border-b border-gray-100 dark:border-white/5">
          <h3 className="font-semibold text-base text-gray-900 dark:text-white">
            Prediction Analysis
          </h3>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
            Stock mention backtest
          </p>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <AnalysisSkeleton />
        </div>
      </div>
    );
  }

  if (stockPerformances.length === 0) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <div className="flex-shrink-0 p-2 border-b border-gray-100 dark:border-white/5">
          <h3 className="font-semibold text-base text-gray-900 dark:text-white">
            Prediction Analysis
          </h3>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
            Stock mention backtest
          </p>
        </div>
        <EmptyState
          icon={BarChart3}
          title="No Predictions Yet"
          description="This KOL hasn't made any stock predictions in their recent tweets"
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 p-2 border-b border-gray-100 dark:border-white/5">
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">
          Prediction Analysis
        </h3>
        <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
          Stock mention backtest
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Win Rate Card with Ring */}
          <Card className="col-span-2">
            <CardContent className="!p-4">
              <div className="flex items-center gap-4">
                <AccuracyRing percentage={stats.accuracy} />
                <div className="flex-1 grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/50 font-medium">
                      Win Rate
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                      {stats.correct}/{stats.total}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/50 font-medium">
                      Stocks
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                      {stats.totalStocks}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/50 font-medium">
                      Mentions
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                      {stats.totalMentions}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/50 font-medium">
                      Bull Bias
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                      {stats.bullishRatio.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <StatCard
            icon={Percent}
            label="Avg Confidence"
            value={`${stats.avgConfidence.toFixed(0)}%`}
            colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <StatCard
            icon={Zap}
            label="Activity"
            value={stats.totalMentions}
            subValue="tweets"
            colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
        </div>

        {/* Stock List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wider">
              Tracked Stocks
            </h4>
            <span className="text-[10px] text-gray-400 dark:text-white/40 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
              {stockPerformances.length} total
            </span>
          </div>

          <div className="space-y-2">
            {stockPerformances.map((performance) => (
              <div key={performance.ticker}>
                <StockRow
                  performance={performance}
                  isSelected={selectedStock === performance.ticker}
                  onSelect={() =>
                    setSelectedStock(
                      selectedStock === performance.ticker
                        ? null
                        : performance.ticker
                    )
                  }
                />
                {selectedStock === performance.ticker &&
                  selectedPerformance && (
                    <StockDetail performance={selectedPerformance} />
                  )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
