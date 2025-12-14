"use client";

import { useState, useEffect, useMemo } from "react";
import { KOLTweet } from "@/lib/kolTweetsApi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Activity,
  Zap,
  MessageSquare,
  Percent,
} from "lucide-react";
import Link from "next/link";
import { HeroSection } from "../ui/hero-section";

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
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 dark:bg-white/[0.02] border border-border/40 dark:border-white/[0.06]">
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center",
          colorClass || "bg-primary/10 text-primary"
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-foreground">{value}</span>
          {subValue && (
            <span className="text-xs text-muted-foreground">{subValue}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AccuracyRing({ percentage }: { percentage: number | null }) {
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    percentage !== null
      ? circumference - (percentage / 100) * circumference
      : circumference;

  const getColor = (pct: number | null) => {
    if (pct === null) return "text-muted-foreground";
    if (pct >= 70) return "text-green-500";
    if (pct >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        {/* Background ring */}
        <circle
          stroke="currentColor"
          className="text-muted/30 dark:text-white/10"
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
        <span className={cn("text-xl font-bold", getColor(percentage))}>
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
        "group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
        "border border-transparent",
        isSelected
          ? "bg-primary/5 dark:bg-primary/10 border-primary/20"
          : "hover:bg-muted/50 dark:hover:bg-white/[0.02]"
      )}
    >
      {/* Ticker */}
      <Link
        href={`/dashboard/stock/${performance.ticker}`}
        onClick={(e) => e.stopPropagation()}
        className="min-w-[60px]"
      >
        <span className="font-mono font-bold text-sm hover:text-primary transition-colors">
          ${performance.ticker}
        </span>
      </Link>

      {/* Sentiment Badge */}
      <div className="flex-shrink-0">
        {overallSentiment === "bullish" ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 dark:bg-green-500/20">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
              Bull
            </span>
          </div>
        ) : overallSentiment === "bearish" ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 dark:bg-red-500/20">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
              Bear
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/10 dark:bg-gray-500/20">
            <Minus className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Neut
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex-1 flex items-center gap-3 text-xs text-muted-foreground">
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
            "text-xs font-medium tabular-nums",
            performance.priceChange7d >= 0 ? "text-green-500" : "text-red-500"
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
          <div className="w-4 h-4 rounded-full border-2 border-dashed border-muted-foreground/30" />
        )}
      </div>

      {/* Arrow */}
      <ChevronRight
        className={cn(
          "w-4 h-4 text-muted-foreground/50 transition-transform",
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
    <div className="mt-2 p-4 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border/40 dark:border-white/[0.06] space-y-4">
      {/* Sentiment Distribution */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Sentiment Distribution
        </p>
        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted/50">
          {bullishCount > 0 && (
            <div
              className="bg-green-500 transition-all"
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
              className="bg-red-500 transition-all"
              style={{
                width: `${
                  (bearishCount / performance.predictions.length) * 100
                }%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span className="text-green-500">{bullishCount} Bullish</span>
          <span className="text-gray-500">{neutralCount} Neutral</span>
          <span className="text-red-500">{bearishCount} Bearish</span>
        </div>
      </div>

      {/* Recent Mentions */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Recent Mentions
        </p>
        <div className="space-y-2">
          {performance.predictions.slice(0, 3).map((pred) => (
            <div
              key={pred.tweetId}
              className="flex gap-2 p-2 rounded-lg bg-background/50 dark:bg-black/20"
            >
              <div className="mt-0.5">
                {pred.sentiment === "bullish" ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : pred.sentiment === "bearish" ? (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                ) : (
                  <Minus className="w-3 h-3 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">
                  {pred.tweetText.length > 120
                    ? pred.tweetText.slice(0, 120) + "..."
                    : pred.tweetText}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimeAgo(pred.predictedAt)}
                  </span>
                  {pred.confidence && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 border-muted-foreground/20"
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
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            +{performance.predictions.length - 3} more mentions
          </p>
        )}
      </div>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-20 flex-1 rounded-xl" />
        <Skeleton className="h-20 flex-1 rounded-xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-[200px]">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 dark:bg-white/[0.03] flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <h4 className="font-medium text-foreground mb-1">No Predictions Yet</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This KOL hasn't made any stock predictions in their recent tweets
        </p>
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
      <div className="h-full flex flex-col bg-background">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold text-base">Prediction Analysis</h3>
        </div>
        <AnalysisSkeleton />
      </div>
    );
  }

  if (stockPerformances.length === 0) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold text-base">Prediction Analysis</h3>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 space-y-4"></div>
      {/* Header */}
      <div className="p-4">
        <HeroSection
          title="Prediction Analysis"
          description="Stock mention backtest"
          features={[
            {
              icon: Target,
              label: "Win Rate",
              iconClassName: "w-3.5 h-3.5 text-green-500",
            },
            {
              icon: Target,
              label: "Stocks",
              iconClassName: "w-3.5 h-3.5 text-blue-500",
            },
          ]}
        />
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Stats Section */}
        <div className="p-4 space-y-3">
          {/* Accuracy Ring + Key Stats */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/20 dark:from-white/[0.03] dark:to-white/[0.01] border border-border/40 dark:border-white/[0.06]">
            <AccuracyRing percentage={stats.accuracy} />
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Win Rate
                </p>
                <p className="text-lg font-bold">
                  {stats.correct}/{stats.total}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Stocks
                </p>
                <p className="text-lg font-bold">{stats.totalStocks}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Mentions
                </p>
                <p className="text-lg font-bold">{stats.totalMentions}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Bull Bias
                </p>
                <p className="text-lg font-bold">
                  {stats.bullishRatio.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={Target}
              label="Avg Confidence"
              value={`${stats.avgConfidence.toFixed(0)}%`}
              colorClass="bg-blue-500/10 text-blue-500"
            />
            <StatCard
              icon={Zap}
              label="Activity"
              value={stats.totalMentions}
              subValue="tweets"
              colorClass="bg-amber-500/10 text-amber-500"
            />
          </div>
        </div>

        {/* Stock List */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tracked Stocks
            </h4>
            <span className="text-[10px] text-muted-foreground">
              {stockPerformances.length} total
            </span>
          </div>

          <div className="space-y-1">
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
