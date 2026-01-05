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
          tag: tag,
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
      <div className="space-y-4 py-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2.5 p-3 border border-transparent"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-6 w-12 rounded-md" />
              <Skeleton className="h-6 w-12 rounded-md" />
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
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-1">
        {newsData.articles.map((article, index) => (
          <React.Fragment key={article.id || index}>
            <NewsCard article={article} />
            {index < newsData.articles.length - 1 && (
              <Separator className="my-1" />
            )}
          </React.Fragment>
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
    </div>
  );
}
