"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { getStockNews, NewsListResponse } from "@/lib/kolPostsApi";
import { NewsCard } from "@/components/news";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, RefreshCw } from "lucide-react";
import { EmptyState, ErrorState } from "../common";

/** Live news sources: FinancialJuice (crawled) + Yahoo Finance */
const LIVE_NEWS_SOURCES = "financial_juice,yahoo_finance";

const JUNK_RE =
  /join us|go real-?time|don'?t like ads|go pro|subscribe now|sign up|free trial|premium access|upgrade your|need to know market risk/i;

function normalizeTitle(t: string): string {
  const stripped = t
    .replace(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{0,2}\.?/g, "")
    .replace(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}/gi, "");
  return stripped.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface LiveNewsListProps {
  pageSize?: number;
  autoRefreshMinutes?: number; // 0 = disabled
}

export default function LiveNewsList({
  pageSize = 30,
  autoRefreshMinutes = 5,
}: LiveNewsListProps) {
  const [newsData, setNewsData] = useState<NewsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchNewsData = useCallback(
    async (pageNum: number, append: boolean = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const result = await getStockNews({
          page: pageNum,
          page_size: pageSize,
          source: LIVE_NEWS_SOURCES,
        });

        if (append && newsData) {
          setNewsData({
            ...result,
            articles: [...newsData.articles, ...result.articles],
          });
        } else {
          setNewsData(result);
        }
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load news");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [pageSize, newsData]
  );

  useEffect(() => {
    fetchNewsData(1);
  }, []);

  // Auto-refresh for live news feel
  useEffect(() => {
    if (autoRefreshMinutes <= 0) return;
    const interval = setInterval(() => {
      fetchNewsData(1);
    }, autoRefreshMinutes * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshMinutes, fetchNewsData]);

  const loadMore = () => {
    fetchNewsData(page + 1, true);
  };

  const handleRetry = () => {
    setError(null);
    fetchNewsData(1);
  };

  const visibleArticles = useMemo(() => {
    if (!newsData) return [];
    const seen = new Set<string>();
    return newsData.articles.filter((a) => {
      if (JUNK_RE.test(a.title) || JUNK_RE.test(a.summary)) return false;
      const key = normalizeTitle(a.title);
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      if (a.analyzed_at && a.us_market_relevance === "none") return false;
      return true;
    });
  }, [newsData]);

  if (loading && !newsData) {
    return (
      <div className="space-y-1.5">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/60 bg-card/60 px-3 py-2.5"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-14 rounded" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <div className="mb-1.5 space-y-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="pt-2 border-t border-border/30">
              <div className="flex flex-wrap gap-1">
                <Skeleton className="h-5 w-12 rounded" />
                <Skeleton className="h-5 w-10 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load live news"
        message={error}
        retry={handleRetry}
      />
    );
  }

  if (!newsData || visibleArticles.length === 0) {
    return (
      <EmptyState
        title="No live news yet"
        description="Run the FinancialJuice webhook to populate news. Configure cron to call POST /api/v1/news/webhook/fetch-financial-juice every 15-30 minutes."
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {autoRefreshMinutes > 0
            ? `Auto-refresh every ${autoRefreshMinutes} min`
            : "Manual refresh"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => fetchNewsData(1)}
          disabled={loading}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {visibleArticles.map((article, index) => (
        <NewsCard article={article} key={article.id || index} />
      ))}

      {newsData.has_more && (
        <div className="mt-4 pb-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full"
          >
            {loadingMore ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <>
                Load More
                <ChevronDown className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
