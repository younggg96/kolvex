"use client";

import React, { useState, useEffect } from "react";
import { StockDiscussionsResponse, StockPost } from "@/lib/kolPostsApi";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ChevronDown, AlertCircle } from "lucide-react";
import SentimentBadge from "@/components/common/SentimentBadge";
import { ErrorState, EmptyState } from "@/components/common/EmptyState";
import KOLList from "./KOLList";
import StockDiscussionsSkeleton from "./StockDiscussionsSkeleton";
import PostHeader from "@/components/post/PostHeader";
import Link from "next/link";
import PostContent from "@/components/post/PostContent";

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
  const [mounted, setMounted] = useState(false);
  const [expandedNonStockPosts, setExpandedNonStockPosts] = useState<
    Set<number>
  >(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // 检查帖子是否与股票相关
  const isStockRelated = (post: StockPost): boolean => {
    // StockPost 没有 is_stock_related 字段，默认为 true
    return true;
  };

  // 切换非股票相关帖子的展开状态
  const toggleNonStockPost = (postId: number) => {
    setExpandedNonStockPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    if (!mounted) {
      return new Date(dateString).toLocaleDateString();
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  const formatText = (text: string) => {
    return text.split(/(\s+)/).map((word, index) => {
      if (word.startsWith("$") && word.length > 1) {
        const ticker = word
          .slice(1)
          .replace(/[.,!?;:'")\]]+$/, "")
          .toUpperCase();
        return (
          <Link
            key={index}
            href={`/dashboard/stock/${ticker}`}
            className="text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {word}
          </Link>
        );
      }
      if (word.startsWith("#")) {
        return (
          <span key={index} className="text-sky-400">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  const renderPostContent = (post: StockPost) => {
    return (
      <PostContent
        fullText={post.content}
        url={post.permalink || ""}
        id={post.id.toString()}
        mediaUrls={post.media_urls?.map((m) => m.url || "") || []}
        aiSummary={post.summary}
        aiTradingSignal={post.trading_signal}
        aiTags={post.ai_tags || []}
        aiModel={post.ai_model}
        aiAnalyzedAt={post.ai_analyzed_at}
        sentiment={post.sentiment}
        onFormatText={formatText}
        likesCount={post.like_count}
      />
    );
  };

  const renderCollapsedNonStockPost = (post: StockPost) => {
    return (
      <div className="py-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => toggleNonStockPost(post.id)}
          className="w-fit h-6 gap-1.5 text-amber-600/80 hover:bg-amber-50 dark:text-amber-500/80 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 font-normal"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            <span className="text-xs">
              This post is unrelated to stocks. Click to view
            </span>
          </div>
        </Button>
      </div>
    );
  };

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
  if (!data || data.total_posts === 0) {
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
            <span>Discussions ({data.total_posts})</span>
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

      {/* 帖子列表 */}
      <div>
        {!data?.posts || data.posts.length === 0 ? (
          <EmptyState
            title="No discussions yet"
            description="No discussions found for this stock"
          />
        ) : (
          <>
            <div className="space-y-1">
              {data.posts.map((post, index) => {
                const stockRelated = isStockRelated(post);
                const isExpanded = expandedNonStockPosts.has(post.id);
                const shouldCollapse = !stockRelated && !isExpanded;

                return (
                  <div key={post.id}>
                    {shouldCollapse ? (
                      <>
                        <PostHeader
                          screenName={post.username}
                          createdAt={
                            post.created_at || new Date().toISOString()
                          }
                          profileImageUrl={post.avatar_url || undefined}
                          onFormatDate={formatDate}
                          kolId={post.username}
                          platform="twitter"
                          initialTracked={false}
                        />
                        {renderCollapsedNonStockPost(post)}
                      </>
                    ) : (
                      <>
                        <PostHeader
                          screenName={post.username}
                          createdAt={
                            post.created_at || new Date().toISOString()
                          }
                          profileImageUrl={post.avatar_url || undefined}
                          onFormatDate={formatDate}
                          kolId={post.username}
                          platform="twitter"
                          initialTracked={false}
                        />
                        {!stockRelated && isExpanded && (
                          <div className="py-1">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => toggleNonStockPost(post.id)}
                              className="w-fit h-6 gap-1.5 text-amber-600/80 hover:bg-amber-50 dark:text-amber-500/80 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 font-normal"
                            >
                              <AlertCircle className="w-3 h-3" />
                              <span className="text-xs">
                                Unrelated to stocks. Click to hide
                              </span>
                            </Button>
                          </div>
                        )}
                        {renderPostContent(post)}
                      </>
                    )}
                    {index < data.posts.length - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                );
              })}
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
          </>
        )}
      </div>
    </>
  );
}
