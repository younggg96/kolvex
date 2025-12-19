"use client";

import React, { useState, useEffect } from "react";
import { KOLTweet } from "@/lib/kolTweetsApi";
import TweetHeader from "@/components/tweet/TweetHeader";
import { TwitterContent } from "@/components/tweet/content";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { Platform } from "@/lib/supabase/database.types";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Helper function to map post platform to database Platform type
const mapPlatform = (platform: string): Platform | undefined => {
  // Since we only support TWITTER now, and backend might not return platform field in KOLTweet
  // We default to TWITTER for now or check if there's a platform field
  return "TWITTER";
};

interface PostFeedListProps {
  posts: KOLTweet[];
  formatDate?: (dateString: string) => string;
  formatText?: (text: string) => React.ReactNode;
}

export default function PostFeedList({
  posts,
  formatDate,
  formatText,
}: PostFeedListProps) {
  const [mounted, setMounted] = useState(false);
  // 跟踪哪些"非股市相关"的推文被手动展开了
  const [expandedNonStockPosts, setExpandedNonStockPosts] = useState<
    Set<number>
  >(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // 检查推文是否与股市相关
  const isStockRelated = (post: KOLTweet): boolean => {
    // 如果没有 is_stock_related 字段，默认显示（向后兼容）
    if (!post.is_stock_related) return true;
    return post.is_stock_related.is_related === true;
  };

  // 切换非股市相关推文的展开状态
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

  const defaultFormatDate = (dateString: string) => {
    if (!mounted) {
      // Return a static format during SSR to prevent hydration mismatch
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

  const defaultFormatText = (text: string) => {
    return text.split(/(\s+)/).map((word, index) => {
      if (word.startsWith("$") && word.length > 1) {
        // Extract ticker symbol (remove $ and any trailing punctuation)
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

  const onFormatDate = formatDate || defaultFormatDate;
  const onFormatText = defaultFormatText;

  const renderPostContent = (post: KOLTweet) => {
    return (
      <TwitterContent
        fullText={post.tweet_text}
        url={post.permalink || ""}
        id={post.id.toString()}
        mediaUrls={post.media_urls?.map((m) => m.url || "") || []}
        aiSummary={post.summary}
        aiTradingSignal={post.trading_signal}
        aiTags={post.tags}
        aiModel={post.ai_model}
        aiAnalyzedAt={post.ai_analyzed_at}
        sentiment={post.sentiment}
        onFormatText={onFormatText}
        likesCount={post.like_count}
      />
    );
  };

  // 渲染折叠的非股市相关推文提示
  const renderCollapsedNonStockPost = (post: KOLTweet) => {
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
              This tweet is unrelated to stocks. Click to view
            </span>
          </div>
        </Button>
      </div>
    );
  };

  return (
    <>
      {posts.map((post, index) => {
        const stockRelated = isStockRelated(post);
        const isExpanded = expandedNonStockPosts.has(post.id);
        const shouldCollapse = !stockRelated && !isExpanded;

        return (
          <div key={post.id}>
            {shouldCollapse ? (
              // 折叠状态：只显示头部和提示
              <>
                <TweetHeader
                  screenName={post.username}
                  createdAt={post.created_at || new Date().toISOString()}
                  profileImageUrl={post.avatar_url || undefined}
                  onFormatDate={onFormatDate}
                  kolId={post.username}
                  platform={mapPlatform("x")}
                  initialTracked={false}
                />
                {renderCollapsedNonStockPost(post)}
              </>
            ) : (
              // 正常显示或已展开状态
              <>
                <TweetHeader
                  screenName={post.username}
                  createdAt={post.created_at || new Date().toISOString()}
                  profileImageUrl={post.avatar_url || undefined}
                  onFormatDate={onFormatDate}
                  kolId={post.username}
                  platform={mapPlatform("x")}
                  initialTracked={false}
                />
                {/* 如果是展开的非股市相关推文，显示收起按钮 */}
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
            {index < posts.length - 1 && <Separator className="my-2" />}
          </div>
        );
      })}
    </>
  );
}
