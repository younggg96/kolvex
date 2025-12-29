"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Percent } from "lucide-react";

// Local imports
import {
  KOLAnalysisPanelProps,
  StockPrediction,
  StockPerformance,
} from "./types";
import { calculateStats } from "./utils";
import { StatCard } from "./StatCard";
import { AccuracyRing } from "./AccuracyRing";
import { StockRow } from "./StockRow";
import { StockDetail } from "./StockDetail";
import { AnalysisSkeleton } from "./AnalysisSkeleton";

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
    return null;
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
