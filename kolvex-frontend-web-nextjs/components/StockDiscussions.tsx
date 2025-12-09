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
import { SwitchTab } from "@/components/ui/switch-tab";
import TweetHeader from "./TweetHeader";
import { TwitterContent } from "./content";
import SectionCard from "./SectionCard";
import {
  Users,
  MessageSquare,
  ChevronDown,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import KOLHoverCard from "./KOLHoverCard";
import SentimentBadge from "./SentimentBadge";

interface StockDiscussionsProps {
  ticker: string;
}

// KOL 头像组件
function KOLAvatar({ kol }: { kol: KOLSummary }) {
  const avatarContent = (
    <div className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer group">
      <div className="relative">
        {/* 波纹动画背景 */}
        <div className="absolute inset-0 rounded-full">
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping [animation-duration:2s]" />
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-pulse [animation-duration:1.5s]" />
        </div>
        {kol.avatar_url ? (
          <img
            src={kol.avatar_url}
            alt={kol.username}
            className="relative w-10 h-10 rounded-full object-cover ring-2 ring-primary/30 group-hover:ring-primary/50 transition-all"
          />
        ) : (
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center ring-2 ring-primary/30 group-hover:ring-primary/50 transition-all">
            <span className="text-sm font-semibold text-primary">
              {kol.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {/* 推文数量 badge */}
        <Badge className="absolute -top-0.5 -right-0.5 z-10 !w-[14px] !h-[14px] rounded-full !p-0 !text-[10px] justify-center bg-primary text-white border-primary/20">
          {kol.tweet_count}
        </Badge>
      </div>
      <span className="text-xs text-muted-foreground truncate max-w-[60px] group-hover:text-primary transition-colors">
        @{kol.username}
      </span>
    </div>
  );

  return (
    <KOLHoverCard
      kolId={kol.username}
      screenName={kol.username}
      profileImageUrl={kol.avatar_url || undefined}
      platform="TWITTER"
    >
      {avatarContent}
    </KOLHoverCard>
  );
}

// 展开更多按钮组件（圆形三个点）
function ExpandButton({
  totalCount,
  showAll,
  onClick,
}: {
  totalCount: number;
  showAll: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <button
        onClick={onClick}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all",
          "bg-muted hover:bg-muted/80 ring-2 ring-primary/20 hover:ring-primary/50",
          showAll && "bg-primary/10 ring-primary/30"
        )}
        title={showAll ? "Collapse" : `View all ${totalCount} KOLs`}
      >
        {showAll ? (
          <ChevronDown className="w-4 h-4 text-primary rotate-180" />
        ) : (
          <MoreHorizontal className="w-4 h-4 text-primary" />
        )}
      </button>
      <span className="text-xs text-muted-foreground">
        {showAll ? "Collapse" : `+${totalCount - 7}`}
      </span>
    </div>
  );
}

// KOL 列表组件
function KOLList({ kols }: { kols: KOLSummary[] }) {
  const [showAll, setShowAll] = useState(false);
  const maxVisible = 7; // 显示7个头像 + 1个展开按钮
  const hasMore = kols.length > maxVisible;
  const displayKols = showAll ? kols : kols.slice(0, maxVisible);

  return (
    <div className="flex flex-wrap gap-4 pt-3">
      {displayKols.map((kol) => (
        <KOLAvatar key={kol.username} kol={kol} />
      ))}
      {hasMore && (
        <ExpandButton
          totalCount={kols.length}
          showAll={showAll}
          onClick={() => setShowAll(!showAll)}
        />
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
  const [activeTab, setActiveTab] = useState("discussions");
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
      <SectionCard
        useSectionHeader={false}
        padding="none"
        contentClassName="p-6"
      >
        <div className="flex items-center justify-center gap-2 py-8 text-red-500">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </SectionCard>
    );
  }

  if (!data || data.total_tweets === 0) {
    return (
      <SectionCard
        useSectionHeader={false}
        padding="none"
        contentClassName="p-6"
      >
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No KOL discussions yet</p>
        </div>
      </SectionCard>
    );
  }

  // 计算整体情绪
  const sentimentKols = data.kols.filter((k) => k.avg_sentiment !== null);
  const avgSentiment =
    sentimentKols.length > 0
      ? sentimentKols.reduce((sum, k) => sum + (k.avg_sentiment || 0), 0) /
        sentimentKols.length
      : null;

  const tabOptions = [
    {
      value: "discussions",
      label: "Discussions",
      icon: <MessageSquare className="w-3.5 h-3.5" />,
    },
    {
      value: "news",
      label: "News",
      icon: <Newspaper className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <SectionCard useSectionHeader={false} padding="none" contentClassName="p-3">
      {/* Switch Tab */}
      <SwitchTab
        options={tabOptions}
        value={activeTab}
        onValueChange={setActiveTab}
        size="md"
        variant="pills"
        className="mb-3 !w-fit"
      />

      {/* Discussions Tab Content */}
      {activeTab === "discussions" && (
        <>
          {/* 头部统计 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Discussions</span>
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
                  {index < data.tweets.length - 1 && (
                    <Separator className="my-3" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* 加载更多 */}
            {data.has_more && (
              <div className="mt-4">
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
        </>
      )}

      {/* News Tab Content */}
      {activeTab === "news" && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Newspaper className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">News coming soon</p>
          <p className="text-xs mt-1">
            Stay tuned for the latest news about {ticker}
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// 骨架屏
export function StockDiscussionsSkeleton() {
  return (
    <SectionCard useSectionHeader={false} padding="none" contentClassName="p-3">
      <div className="animate-pulse">
        {/* Tab 骨架 */}
        <div className="h-10 bg-muted rounded-lg mb-3" />

        {/* 头部统计骨架 */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-5 bg-muted rounded w-16" />
        </div>

        {/* KOL 头像骨架 */}
        <div className="flex gap-4 mb-6 pt-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-muted rounded-full" />
              <div className="h-3 bg-muted rounded w-12" />
            </div>
          ))}
        </div>

        <div className="h-px bg-muted mb-3" />

        {/* 推文骨架 */}
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
    </SectionCard>
  );
}
