"use client";

import React from "react";
import { StockDiscussionsResponse } from "@/lib/kolTweetsApi";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import SentimentBadge from "@/components/common/SentimentBadge";
import { ErrorState, EmptyState } from "@/components/common/EmptyState";
import KOLList from "./KOLList";
import TweetCard from "./TweetCard";
import StockDiscussionsSkeleton from "./StockDiscussionsSkeleton";

interface DiscussionsTabContentProps {
  data: StockDiscussionsResponse | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
}

export default function DiscussionsTabContent({
  data,
  loading,
  loadingMore,
  error,
  onLoadMore,
  onRetry,
}: DiscussionsTabContentProps) {
  // 加载状态
  if (loading) {
    return <StockDiscussionsSkeleton />;
  }

  // 错误状态
  if (error) {
    return (
      <ErrorState
        title="Failed to load discussions"
        message={error}
        retry={onRetry}
      />
    );
  }

  // 空状态
  if (!data || data.total_tweets === 0) {
    return (
      <EmptyState
        title="No discussions yet"
        description="No one is talking about this stock"
        action={{ label: "Refresh", onClick: onRetry }}
      />
    );
  }

  // 计算整体情绪
  const sentimentKols = data.kols.filter((k) => k.avg_sentiment !== null);
  const avgSentiment =
    sentimentKols.length > 0
      ? sentimentKols.reduce((sum, k) => sum + (k.avg_sentiment || 0), 0) /
        sentimentKols.length
      : null;

  // 有数据
  return (
    <>
      {/* 头部统计 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <span>Discussions ({data.total_tweets})</span>
          </span>
          {avgSentiment !== null && (
            <SentimentBadge
              sentiment={{
                value:
                  avgSentiment > 20
                    ? "bullish"
                    : avgSentiment < -20
                    ? "bearish"
                    : "neutral",
                confidence: null,
                reasoning: null,
              }}
            />
          )}
        </div>

        {/* KOL 列表 */}
        <KOLList kols={data.kols} />
      </div>

      <Separator className="mb-3" />

      {/* 推文列表 */}
      <div>
        <div className="space-y-1">
          {data.tweets.map((tweet, index) => (
            <React.Fragment key={tweet.id}>
              <TweetCard tweet={tweet} />
              {index < data.tweets.length - 1 && <Separator className="my-3" />}
            </React.Fragment>
          ))}
        </div>

        {/* 加载更多 */}
        {data.has_more && (
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={onLoadMore}
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
    </>
  );
}

