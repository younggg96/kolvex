"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getStockNews, NewsListResponse } from "@/lib/kolPostsApi";
import { NewsCard } from "@/components/news";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, AlertCircle, Newspaper } from "lucide-react";
import { EmptyState, ErrorState } from "../common";

interface NewsArticleListProps {
  ticker?: string;
  tag?: string;
  pageSize?: number;
}

export default function NewsArticleList({
  ticker,
  tag,
  pageSize = 20,
}: NewsArticleListProps) {
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
          ticker: ticker,
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
    [ticker, tag, pageSize, newsData]
  );

  useEffect(() => {
    fetchNewsData(1);
  }, [ticker, tag]);

  const loadMore = () => {
    fetchNewsData(page + 1, true);
  };

  if (loading && !newsData) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 dark:border-border-dark/50 bg-card-light dark:bg-card-dark/50 backdrop-blur-sm p-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-3 w-1 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>

            {/* Content */}
            <div className="mb-3 space-y-1.5">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-border/30 dark:border-border-dark/30">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Skeleton className="h-6 w-14 rounded-md" />
                <Skeleton className="h-6 w-12 rounded-md" />
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load news" message={error} />;
  }

  if (!newsData || newsData.articles.length === 0) {
    return (
      <EmptyState
        title="No news articles found"
        description="No news articles found for this ticker"
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2">
      {newsData.articles.map((article, index) => (
        <NewsCard article={article} key={article.id || index} />
      ))}

      {/* Load more */}
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
