import { useState, useEffect, useCallback } from "react";
import { XhsPost } from "@/lib/xhsApi";

const PAGE_SIZE = 20;

/**
 * 将统一的 KOLPost 格式转换为 XhsPost 格式
 */
function transformToXhsPosts(posts: any[]): XhsPost[] {
  return posts.map((post) => ({
    id: post.id,
    platform: post.platform || "xiaohongshu",
    platform_post_id: post.platform_post_id,
    note_id: post.platform_post_id || post.note_id || "",
    post_hash: post.post_hash || null,
    title: post.title || null,
    content: post.content || null,
    note_type: post.post_type || "normal",
    permalink: post.permalink || null,
    author_name: post.display_name || post.username || null,
    author_id: post.author_platform_id || post.username || null,
    author_avatar: post.avatar_url || null,
    cover_url: post.cover_url || null,
    image_urls: Array.isArray(post.media_urls)
      ? post.media_urls
          .map((m: any) => (typeof m === "string" ? m : m.url))
          .filter(Boolean)
      : [],
    video_url: post.video_url || null,
    like_count: post.like_count || 0,
    collect_count: post.collect_count || post.bookmark_count || 0,
    comment_count: post.reply_count || 0,
    share_count: post.share_count || post.repost_count || 0,
    tags: post.tags || [],
    search_keyword: post.search_keyword || null,
    ai_sentiment: post.sentiment?.value || null,
    ai_sentiment_confidence: post.sentiment?.confidence || 0,
    ai_sentiment_reasoning: post.sentiment?.reasoning || null,
    ai_tickers: post.tickers || [],
    ai_tags: post.ai_tags || [],
    ai_summary: post.summary || null,
    ai_trading_signal: post.trading_signal?.action || null,
    ai_is_stock_related: post.is_stock_related?.is_related || false,
    ai_stock_related_confidence: post.is_stock_related?.confidence || 0,
    ai_stock_related_reason: post.is_stock_related?.reason || null,
    ai_analyzed_at: post.ai_analyzed_at || null,
    ai_model: post.ai_model || null,
    created_at: post.created_at || null,
    scraped_at: post.scraped_at || null,
    updated_at: null,
  }));
}

interface UseXhsPostsOptions {
  selectedTab: string;
}

interface UseXhsPostsReturn {
  posts: XhsPost[];
  isLoading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refreshPosts: () => void;
  loadMorePosts: () => Promise<void>;
}

export function useXhsPosts({
  selectedTab,
}: UseXhsPostsOptions): UseXhsPostsReturn {
  const [posts, setPosts] = useState<XhsPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const getApiEndpoint = useCallback((): string => {
    if (selectedTab === "tracking") {
      return `/api/kol-subscriptions/posts?platform=xiaohongshu`;
    }
    return "/api/tweets?platform=xiaohongshu";
  }, [selectedTab]);

  const fetchPosts = useCallback(
    async (forceRefresh: boolean = false) => {
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
        const fetchedPosts = transformToXhsPosts(data.tweets || data.posts || []);

        setPosts(fetchedPosts);
        setHasMore(fetchedPosts.length >= PAGE_SIZE);
        setIsLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    },
    [getApiEndpoint]
  );

  const refreshPosts = useCallback(() => {
    fetchPosts(true);
  }, [fetchPosts]);

  const loadMorePosts = useCallback(async () => {
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
  }, [loadingMore, hasMore, offset, getApiEndpoint, posts]);

  // Initial fetch
  useEffect(() => {
    if (!isLoaded) {
      fetchPosts();
    }
  }, [isLoaded, fetchPosts]);

  // Reset data and refetch when switching tabs
  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(true);
    setIsLoaded(false);
  }, [selectedTab]);

  return {
    posts,
    isLoading,
    loadingMore,
    error,
    hasMore,
    refreshPosts,
    loadMorePosts,
  };
}
