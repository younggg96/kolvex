"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  getStockDiscussions,
  StockDiscussionsResponse,
  KOLSummary,
  StockTweet,
  formatNumber,
  formatTimeAgo,
  getSentimentColor,
  getSentimentBgColor,
  getSentimentIcon,
  getSentimentLabel,
} from "@/lib/kolTweetsApi";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TweetHeader from "./TweetHeader";
import { TwitterContent } from "./content";
import {
  Users,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StockDiscussionsProps {
  ticker: string;
}

// KOL 头像组件
function KOLAvatar({ kol }: { kol: KOLSummary }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <div className="relative">
        {kol.avatar_url ? (
          <img
            src={kol.avatar_url}
            alt={kol.username}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-border/50"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center ring-2 ring-border/50">
            <span className="text-sm font-semibold text-primary">
              {kol.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {kol.is_verified && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
            <svg
              className="w-2.5 h-2.5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground truncate max-w-[60px]">
        @{kol.username}
      </span>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <MessageSquare className="w-3 h-3" />
        <span>{kol.tweet_count}</span>
      </div>
    </div>
  );
}

// KOL 列表组件
function KOLList({ kols }: { kols: KOLSummary[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayKols = showAll ? kols : kols.slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            KOLs discussing this stock ({kols.length})
          </h3>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {displayKols.map((kol) => (
          <KOLAvatar key={kol.username} kol={kol} />
        ))}
      </div>

      {kols.length > 8 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full text-xs"
        >
          {showAll ? "Collapse" : `View all ${kols.length} KOLs`}
          <ChevronDown
            className={cn(
              "w-4 h-4 ml-1 transition-transform",
              showAll && "rotate-180"
            )}
          />
        </Button>
      )}
    </div>
  );
}

// 推文卡片组件
function TweetCard({ tweet }: { tweet: StockTweet }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      if (word.startsWith("#") || word.startsWith("$")) {
        return (
          <span key={index} className="text-sky-400">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  return (
    <div className="space-y-2">
      <TweetHeader
        screenName={tweet.username}
        createdAt={tweet.created_at || new Date().toISOString()}
        profileImageUrl={tweet.avatar_url || undefined}
        onFormatDate={formatDate}
        kolId={tweet.username}
        platform="TWITTER"
        initialTracked={false}
      />
      <TwitterContent
        fullText={tweet.tweet_text}
        url={tweet.permalink || ""}
        id={tweet.id.toString()}
        mediaUrls={tweet.media_urls?.map((m) => m.url || "") || []}
        aiSummary={tweet.summary}
        aiTradingSignal={tweet.trading_signal}
        aiTags={tweet.tags}
        aiModel={tweet.ai_model}
        aiAnalyzedAt={tweet.ai_analyzed_at}
        sentiment={tweet.sentiment}
        onFormatText={formatText}
        likesCount={tweet.like_count}
      />
    </div>
  );
}

// 主组件
export default function StockDiscussions({ ticker }: StockDiscussionsProps) {
  const [data, setData] = useState<StockDiscussionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchData = useCallback(
    async (pageNum: number, append: boolean = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const result = await getStockDiscussions(ticker, {
          page: pageNum,
          page_size: pageSize,
          sort_by: "created_at",
          sort_direction: "desc",
        });

        if (append && data) {
          setData({
            ...result,
            tweets: [...data.tweets, ...result.tweets],
          });
        } else {
          setData(result);
        }
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [ticker, data]
  );

  useEffect(() => {
    fetchData(1);
  }, [ticker]);

  const loadMore = () => {
    fetchData(page + 1, true);
  };

  if (loading) {
    return <StockDiscussionsSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark p-6 transition-colors duration-300">
        <div className="flex items-center justify-center gap-2 py-8 text-red-500">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data || data.total_tweets === 0) {
    return (
      <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark p-6 transition-colors duration-300">
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No KOL discussions yet</p>
        </div>
      </div>
    );
  }

  // 计算整体情绪
  const sentimentKols = data.kols.filter((k) => k.avg_sentiment !== null);
  const avgSentiment =
    sentimentKols.length > 0
      ? sentimentKols.reduce((sum, k) => sum + (k.avg_sentiment || 0), 0) /
        sentimentKols.length
      : null;

  return (
    <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark p-4 transition-colors duration-300">
      {/* 头部统计 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {ticker} KOL Discussions
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{data.total_kols} KOLs</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              <span>{data.total_tweets} Tweets</span>
            </div>
            {avgSentiment !== null && (
              <Badge
                variant="secondary"
                className={cn(
                  "flex items-center gap-1",
                  avgSentiment > 20
                    ? "bg-green-500/10 text-green-600"
                    : avgSentiment < -20
                    ? "bg-red-500/10 text-red-600"
                    : "bg-gray-500/10 text-gray-600"
                )}
              >
                {avgSentiment > 20 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : avgSentiment < -20 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : null}
                <span>
                  {avgSentiment > 20
                    ? "Bullish"
                    : avgSentiment < -20
                    ? "Bearish"
                    : "Neutral"}
                </span>
              </Badge>
            )}
          </div>
        </div>

        {/* KOL 列表 */}
        <KOLList kols={data.kols} />
      </div>

      <Separator className="my-6" />

      {/* 推文列表 */}
      <div>
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          Latest Discussions
        </h3>

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
          <div className="mt-4 pt-4 border-t border-border/30">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
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

// 骨架屏
export function StockDiscussionsSkeleton() {
  return (
    <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark p-4 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 bg-muted rounded w-32" />
        <div className="flex gap-4">
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-20" />
        </div>
      </div>
      <div className="flex gap-4 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 bg-muted rounded-full" />
            <div className="h-3 bg-muted rounded w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-muted rounded-full" />
              <div className="h-4 bg-muted rounded w-24" />
            </div>
            <div className="h-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
