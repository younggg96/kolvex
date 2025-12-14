"use client";

import React from "react";
import { NewsListResponse } from "@/lib/kolTweetsApi";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NewsCard } from "@/components/news";
import { ChevronDown } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";

interface NewsTabContentProps {
  ticker: string;
  newsData: NewsListResponse | null;
  newsLoading: boolean;
  newsLoadingMore: boolean;
  newsError: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
}

// 新闻列表骨架屏
function NewsListSkeleton() {
  return (
    <div className="space-y-3 py-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-3 p-3">
          <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 新闻列表空状态
function NewsEmptyState({
  ticker,
  onRetry,
}: {
  ticker: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      title="No news yet"
      description={`No news found for this stock ${ticker}`}
      action={{ label: "Refresh", onClick: onRetry }}
    />
  );
}

// 新闻列表错误状态
function NewsErrorState({
  error,
  onRetry,
}: {
  error?: string | null;
  onRetry: () => void;
}) {
  return (
    <ErrorState
      title="Failed to load news"
      message={error || ""}
      retry={onRetry}
    />
  );
}

// 加载更多按钮
function LoadMoreButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-4">
      <Button
        variant="outline"
        onClick={onClick}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
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
  );
}

export default function NewsTabContent({
  ticker,
  newsData,
  newsLoading,
  newsLoadingMore,
  newsError,
  onLoadMore,
  onRetry,
}: NewsTabContentProps) {
  // 加载状态
  if (newsLoading) {
    return <NewsListSkeleton />;
  }

  // 错误状态
  if (newsError) {
    return <NewsErrorState error={newsError} onRetry={onRetry} />;
  }

  // 空状态
  if (!newsData || newsData.articles.length === 0) {
    return <NewsEmptyState ticker={ticker} onRetry={onRetry} />;
  }

  // 新闻列表
  return (
    <div>
      <div className="space-y-1">
        {newsData.articles.map((article, index) => (
          <React.Fragment key={article.id || index}>
            <NewsCard article={article} />
            {index < newsData.articles.length - 1 && (
              <Separator className="my-1" />
            )}
          </React.Fragment>
        ))}
      </div>

      {newsData.has_more && (
        <LoadMoreButton loading={newsLoadingMore} onClick={onLoadMore} />
      )}
    </div>
  );
}

// 导出子组件供单独使用
export { NewsListSkeleton, NewsEmptyState, NewsErrorState, LoadMoreButton };
