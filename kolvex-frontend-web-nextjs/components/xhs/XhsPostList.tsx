"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import SectionCard from "@/components/layout/SectionCard";
import Image from "next/image";
import { XhsPost } from "@/lib/xhsApi";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Button } from "@/components/ui/button";
import { RotateCcw, BookHeart } from "lucide-react";
import { MultiSelectOption } from "@/components/ui/multi-select";
import { FilterSheet, DateRange } from "@/components/common/FilterSheet";
import XhsPostFeedList from "./XhsPostFeedList";
import { cn } from "@/lib/utils";
import { POST_TAB_OPTIONS } from "@/lib/platformConfig";
import { KOLTweet } from "@/lib/kolTweetsApi";

const PostTabOption = [...POST_TAB_OPTIONS];

/**
 * 将统一的 KOLTweet 格式转换为 XhsPost 格式
 * 用于兼容现有的 XhsPostFeedList 组件
 */
function transformToXhsPosts(tweets: any[]): XhsPost[] {
  return tweets.map((tweet) => ({
    id: tweet.id,
    platform: tweet.platform || "xiaohongshu",
    platform_post_id: tweet.platform_post_id,
    note_id: tweet.platform_post_id || tweet.note_id || "",
    post_hash: tweet.tweet_hash || null,
    title: tweet.title || null,
    content: tweet.tweet_text || tweet.content || null,
    note_type: tweet.post_type || "normal",
    permalink: tweet.permalink || null,
    // 作者信息
    author_name: tweet.display_name || tweet.username || null,
    author_id: tweet.author_platform_id || tweet.username || null,
    author_avatar: tweet.avatar_url || null,
    // 媒体资源
    cover_url: tweet.cover_url || null,
    image_urls: Array.isArray(tweet.media_urls)
      ? tweet.media_urls.map((m: any) => (typeof m === "string" ? m : m.url)).filter(Boolean)
      : [],
    video_url: tweet.video_url || null,
    // 互动数据
    like_count: tweet.like_count || 0,
    collect_count: tweet.collect_count || tweet.bookmark_count || 0,
    comment_count: tweet.reply_count || 0,
    share_count: tweet.share_count || tweet.retweet_count || 0,
    // 标签
    tags: tweet.tags || [],
    search_keyword: tweet.search_keyword || null,
    // AI 分析结果
    ai_sentiment: tweet.sentiment?.value || null,
    ai_sentiment_confidence: tweet.sentiment?.confidence || 0,
    ai_sentiment_reasoning: tweet.sentiment?.reasoning || null,
    ai_tickers: tweet.tickers || [],
    ai_tags: tweet.tags || [],
    ai_summary: tweet.summary || null,
    ai_trading_signal: tweet.trading_signal?.action || null,
    ai_is_stock_related: tweet.is_stock_related?.is_related || false,
    ai_stock_related_confidence: tweet.is_stock_related?.confidence || 0,
    ai_stock_related_reason: tweet.is_stock_related?.reason || null,
    ai_analyzed_at: tweet.ai_analyzed_at || null,
    ai_model: tweet.ai_model || null,
    // 时间戳
    created_at: tweet.created_at || null,
    scraped_at: tweet.scraped_at || null,
    updated_at: null,
  }));
}

export default function XhsPostList({ className }: { className?: string }) {
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Posts data
  const [posts, setPosts] = useState<XhsPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  const PAGE_SIZE = 20;

  // Extract unique authors from posts
  const availableAuthors = useMemo(() => {
    const uniqueAuthorsMap = new Map<
      string,
      { author: string; authorId: string; avatarUrl: string }
    >();

    posts.forEach((post) => {
      const authorId = post.author_id || "";
      const authorName = post.author_name || post.author_id || "未知用户";

      if (authorId && !uniqueAuthorsMap.has(authorId)) {
        uniqueAuthorsMap.set(authorId, {
          author: authorName,
          authorId: authorId,
          avatarUrl: post.author_avatar || "",
        });
      }
    });

    return Array.from(uniqueAuthorsMap.values()).sort((a, b) =>
      a.author.localeCompare(b.author)
    );
  }, [posts]);

  // Convert authors to MultiSelect options
  const authorOptions: MultiSelectOption[] = useMemo(() => {
    return availableAuthors.map((author) => ({
      label: author.author,
      value: author.authorId,
      icon: (
        <Image
          src={author.avatarUrl || "/placeholder-user.jpg"}
          alt={author.author}
          width={16}
          height={16}
          className="w-4 h-4 rounded-full"
        />
      ),
    }));
  }, [availableAuthors]);

  // Extract unique tags from posts
  const availableTags = useMemo(() => {
    const uniqueTagsSet = new Set<string>();

    posts.forEach((post) => {
      if (post.ai_tags) {
        post.ai_tags.forEach((tag) => {
          uniqueTagsSet.add(tag);
        });
      }
      if (post.tags) {
        post.tags.forEach((tag) => {
          uniqueTagsSet.add(tag);
        });
      }
    });

    return Array.from(uniqueTagsSet).sort();
  }, [posts]);

  // Convert tags to MultiSelect options
  const tagOptions: MultiSelectOption[] = useMemo(() => {
    return availableTags.map((tag) => ({
      label: tag,
      value: tag,
    }));
  }, [availableTags]);

  // Helper function to filter by time range
  const isWithinTimeRange = useCallback(
    (postDate: string | null, range: string): boolean => {
      if (!postDate) return false;
      if (range === "all") return true;

      const now = new Date();
      const postTime = new Date(postDate);

      // Custom date range filter
      if (range === "custom" && dateRange) {
        const hasFrom = dateRange.from !== undefined;
        const hasTo = dateRange.to !== undefined;

        if (hasFrom && hasTo) {
          return postTime >= dateRange.from! && postTime <= dateRange.to!;
        } else if (hasFrom) {
          return postTime >= dateRange.from!;
        } else if (hasTo) {
          return postTime <= dateRange.to!;
        }
        return true;
      }

      // Preset time range filters
      const diffInMs = now.getTime() - postTime.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);

      switch (range) {
        case "1h":
          return diffInHours <= 1;
        case "24h":
          return diffInHours <= 24;
        case "7d":
          return diffInHours <= 24 * 7;
        case "30d":
          return diffInHours <= 24 * 30;
        case "3m":
          return diffInHours <= 24 * 90;
        default:
          return true;
      }
    },
    [dateRange]
  );

  // Filter posts based on selected authors, tags, and time range
  const filteredPosts = useMemo(() => {
    let filtered = posts;

    // Filter by authors
    if (selectedAuthors.length > 0) {
      filtered = filtered.filter((post) =>
        selectedAuthors.includes(post.author_id || "")
      );
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(
        (post) =>
          (post.ai_tags &&
            post.ai_tags.some((tag) => selectedTags.includes(tag))) ||
          (post.tags && post.tags.some((tag) => selectedTags.includes(tag)))
      );
    }

    // Filter by time range or custom date range
    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter((post) => {
        const postDate = post.scraped_at || post.created_at;
        if (!postDate) return false;
        const postTime = new Date(postDate);
        const hasFrom = dateRange.from !== undefined;
        const hasTo = dateRange.to !== undefined;

        if (hasFrom && hasTo) {
          return postTime >= dateRange.from! && postTime <= dateRange.to!;
        } else if (hasFrom) {
          return postTime >= dateRange.from!;
        } else if (hasTo) {
          return postTime <= dateRange.to!;
        }
        return true;
      });
    } else if (timeRange !== "all" && timeRange !== "") {
      filtered = filtered.filter((post) =>
        isWithinTimeRange(post.scraped_at || post.created_at, timeRange)
      );
    }

    return filtered;
  }, [
    posts,
    selectedAuthors,
    selectedTags,
    timeRange,
    dateRange,
    isWithinTimeRange,
  ]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedAuthors.length > 0) count++;
    if (selectedTags.length > 0) count++;
    if (timeRange !== "all" || dateRange?.from || dateRange?.to) count++;
    return count;
  }, [selectedAuthors, selectedTags, timeRange, dateRange]);

  useEffect(() => {
    if (!hasLoaded) {
      fetchPosts();
    }
  }, [hasLoaded]);

  // Reset data and refetch when switching tabs
  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(true);
    setHasLoaded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab]);

  const getApiEndpoint = (): string => {
    // If tracking tab is selected, use the tracking API with platform filter
    if (selectedTab === "tracking") {
      return `/api/kol-subscriptions/posts?platform=xiaohongshu`;
    }
    // 使用统一的 /api/tweets 端点，通过 platform 参数过滤
    return "/api/tweets?platform=xiaohongshu";
  };

  const fetchPosts = async (forceRefresh: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);
      setOffset(0);

      const endpoint = getApiEndpoint();
      const separator = endpoint.includes("?") ? "&" : "?";
      const paginatedEndpoint = `${endpoint}${separator}limit=${PAGE_SIZE}&offset=0`;

      const response = await fetch(paginatedEndpoint, {
        cache: forceRefresh ? "no-store" : "default",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }

      const data = await response.json();
      // 支持两种响应格式：posts (旧) 和 tweets (新统一格式)
      const fetchedPosts = transformToXhsPosts(data.tweets || data.posts || []);

      setPosts(fetchedPosts);
      setHasMore(fetchedPosts.length >= PAGE_SIZE);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPosts = () => {
    fetchPosts(true);
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const newOffset = offset + PAGE_SIZE;

      const endpoint = getApiEndpoint();
      const separator = endpoint.includes("?") ? "&" : "?";
      const paginatedEndpoint = `${endpoint}${separator}limit=${PAGE_SIZE}&offset=${newOffset}`;

      const response = await fetch(paginatedEndpoint);

      if (!response.ok) {
        throw new Error("Failed to fetch more posts");
      }

      const data = await response.json();
      // 支持两种响应格式：posts (旧) 和 tweets (新统一格式)
      const fetchedPosts = transformToXhsPosts(data.tweets || data.posts || []);

      const filteredNewPosts = fetchedPosts.filter(
        (newPost: XhsPost) => !posts.some((post) => post.id === newPost.id)
      );

      setPosts((prev) => [...prev, ...filteredNewPosts]);
      setOffset(newOffset);
      setHasMore(fetchedPosts.length >= PAGE_SIZE);
    } catch (err) {
      console.error("Failed to load more posts:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPercentage =
      (target.scrollTop + target.clientHeight) / target.scrollHeight;

    if (scrollPercentage > 0.9 && hasMore && !loadingMore) {
      loadMorePosts();
    }
  };

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
  };

  return (
    <SectionCard
      headerBorder
      padding="md"
      scrollable
      contentClassName="space-y-0 px-4 pb-0 pt-2 mt-2"
      onScroll={handleScroll}
      className={cn("h-full flex flex-col", className)}
      headerExtra={
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
          <SwitchTab
            options={PostTabOption}
            value={selectedTab}
            onValueChange={handleTabChange}
            size="md"
            variant="pills"
            className="!w-fit mb-2"
          />
        </div>
      }
      headerRightExtra={
        <div className="flex items-center gap-2 pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshPosts}
            aria-label="Refresh"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>

          <FilterSheet
            authorOptions={authorOptions}
            selectedAuthors={selectedAuthors}
            onAuthorsChange={setSelectedAuthors}
            tagOptions={tagOptions}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            activeFilterCount={activeFilterCount}
          />
        </div>
      }
      headerClassName="!pb-0 !pt-2"
    >
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[...Array(10)].map((_, i) => (
            <CardSkeleton key={i} lines={10} />
          ))}
        </div>
      )}

      {filteredPosts.length === 0 && !isLoading && !error && (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <EmptyState
            icon={BookHeart}
            title={
              selectedAuthors.length > 0 || selectedTags.length > 0
                ? "No posts match the selected filters"
                : "No posts available"
            }
            description={
              selectedAuthors.length > 0 || selectedTags.length > 0
                ? "Try adjusting the filters or clear them to see more posts."
                : "No posts available"
            }
          />
        </div>
      )}

      {error && !isLoading && (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <ErrorState title="Error" message={error} retry={refreshPosts} />
        </div>
      )}

      <XhsPostFeedList posts={filteredPosts} />

      {/* Loading More Indicator */}
      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
            <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading more posts...</span>
          </div>
        </div>
      )}

      {/* No More Data Indicator */}
      {!hasMore && filteredPosts.length > 0 && (
        <div className="py-4 text-center text-xs text-gray-400 dark:text-white/30">
          All posts loaded
        </div>
      )}
    </SectionCard>
  );
}
