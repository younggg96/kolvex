"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import MiniSparkline from "@/components/stock/MiniSparkline";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface IndexData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  chartData?: number[];
}

interface MarketOverviewProps {
  className?: string;
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function IndexCard({ index }: { index: IndexData }) {
  const isPositive = index.change >= 0;

  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
          {index.name}
        </p>
        <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
          {formatValue(index.value)}
        </p>
      </div>

      {/* Sparkline */}
      {index.chartData && index.chartData.length > 0 && (
        <div className="flex-shrink-0">
          <MiniSparkline
            data={index.chartData}
            width={64}
            height={28}
            strokeWidth={1.5}
            color={isPositive ? "#00C805" : "#ef4444"}
          />
        </div>
      )}

      {/* Change Badge */}
      <Badge
        variant="outline"
        size="sm"
        className={cn(
          "flex items-center gap-1 border-0 tabular-nums font-semibold",
          isPositive
            ? "bg-primary/10 text-primary"
            : "bg-red-500/10 text-red-500"
        )}
      >
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        <span>
          {isPositive ? "+" : ""}
          {index.changePercent.toFixed(2)}%
        </span>
      </Badge>
    </Card>
  );
}

function IndexSkeleton() {
  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <Skeleton className="h-3 w-16 mb-1.5" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="w-16 h-7 rounded" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </Card>
  );
}

export default function MarketOverview({ className }: MarketOverviewProps) {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIndices = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/market/indices");
      if (!response.ok) {
        throw new Error("Failed to fetch indices");
      }
      const data = await response.json();
      setIndices(data);
    } catch (err) {
      console.error("Error fetching market indices:", err);
      setError("Unable to load market data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIndices();

    // Refresh every 60 seconds
    const interval = setInterval(fetchIndices, 60000);
    return () => clearInterval(interval);
  }, [fetchIndices]);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    fetchIndices();
  }, [fetchIndices]);

  if (error) {
    return (
      <div className={cn("p-4", className)}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Market Overview
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={fetchIndices}
                  aria-label="Refresh market data"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Market Overview
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefresh}
                disabled={isLoading}
                aria-label="Refresh market data"
              >
                <RefreshCw
                  className={cn("w-3.5 h-3.5", isLoading && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refresh</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <IndexSkeleton key={i} />)
          : indices.map((index) => (
            <IndexCard key={index.symbol} index={index} />
          ))}
      </div>
    </div>
  );
}
