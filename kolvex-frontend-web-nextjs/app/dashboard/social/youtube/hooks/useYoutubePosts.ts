import { useState, useEffect, useCallback } from "react";
import { KOLPost } from "@/lib/kolPostsApi";

const PAGE_SIZE = 20;

interface UseYoutubePostsOptions {
  selectedTab: string;
}

interface UseYoutubePostsReturn {
  posts: KOLPost[];
  isLoading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refreshPosts: () => void;
  loadMorePosts: () => Promise<void>;
}

export function useYoutubePosts({
  selectedTab,
}: UseYoutubePostsOptions): UseYoutubePostsReturn {
  const [posts, setPosts] = useState<KOLPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const getApiEndpoint = useCallback((): string => {
    if (selectedTab === "tracking") {
      return `/api/kol-subscriptions/posts?platform=youtube`;
    }
    return "/api/tweets?platform=youtube";
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
          throw new Error("Failed to fetch YouTube videos");
        }

        const data = await response.json();
        const fetchedPosts = data.tweets || data.posts || [];

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
      if (!response.ok) throw new Error("Failed to fetch more videos");

      const data = await response.json();
      const fetchedPosts = data.tweets || data.posts || [];

      const filteredNewPosts = fetchedPosts.filter(
        (newPost: KOLPost) => !posts.some((p) => p.id === newPost.id)
      );

      setPosts((prev) => [...prev, ...filteredNewPosts]);
      setOffset(newOffset);
      setHasMore(fetchedPosts.length >= PAGE_SIZE);
    } catch (err) {
      console.error("Failed to load more videos:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset, getApiEndpoint, posts]);

  useEffect(() => {
    if (!isLoaded) {
      fetchPosts();
    }
  }, [isLoaded, fetchPosts]);

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
