"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { CardSkeleton } from "./LoadingSkeleton";
import { EmptyState, ErrorState } from "./EmptyState";
import SectionCard from "./SectionCard";
import Image from "next/image";
import { KOLTweet } from "@/lib/kolTweetsApi";
import { SwitchTab } from "./ui/switch-tab";
import { Button } from "./ui/button";
import { RotateCcw } from "lucide-react";
import { MultiSelectOption } from "./ui/multi-select";
import { FilterSheet, DateRange } from "./FilterSheet";
import PostFeedList from "./PostFeedList";
import { cn } from "@/lib/utils";
import { POST_TAB_OPTIONS } from "@/lib/platformConfig";

type Platform = "x";

const PostTabOption = [...POST_TAB_OPTIONS];

const PlatformTabOption = [
  {
    value: "x",
    label: "X",
    icon: (
      <Image
        src="/logo/x.svg"
        alt="X"
        width={16}
        height={16}
        className="w-4 h-4"
      />
    ),
  },
];

export default function PostList({ className }: { className?: string }) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("x");
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Cache posts data for each platform
  const [platformPosts, setPlatformPosts] = useState<
    Record<Platform, KOLTweet[]>
  >({
    x: [],
  });

  // Track loading state for each platform
  const [platformLoading, setPlatformLoading] = useState<
    Record<Platform, boolean>
  >({
    x: false,
  });

  // Track which platforms have been loaded
  const [loadedPlatforms, setLoadedPlatforms] = useState<Set<Platform>>(
    new Set()
  );

  const [loadingMore, setLoadingMore] = useState(false);

  // Track errors for each platform
  const [platformErrors, setPlatformErrors] = useState<
    Record<Platform, string | null>
  >({
    x: null,
  });

  // Track hasMore for each platform
  const [platformHasMore, setPlatformHasMore] = useState<
    Record<Platform, boolean>
  >({
    x: true,
  });

  // Track offset for each platform for pagination
  const [platformOffset, setPlatformOffset] = useState<
    Record<Platform, number>
  >({
    x: 0,
  });

  const PAGE_SIZE = 20;

  // Get current platform data
  const currentPosts = platformPosts[selectedPlatform];
  const isLoading = platformLoading[selectedPlatform];
  const currentError = platformErrors[selectedPlatform];
  const hasMore = platformHasMore[selectedPlatform];

  // Extract unique authors from current platform posts
  const availableAuthors = useMemo(() => {
    const uniqueAuthorsMap = new Map<
      string,
      { author: string; authorId: string; avatarUrl: string }
    >();

    currentPosts.forEach((post) => {
      // Assuming KOLTweet has username/display_name instead of author/authorId
      // and we want to use username as authorId
      const authorId = post.username;
      const authorName = post.display_name || post.username;

      if (!uniqueAuthorsMap.has(authorId)) {
        uniqueAuthorsMap.set(authorId, {
          author: authorName,
          authorId: authorId,
          avatarUrl: post.avatar_url || "",
        });
      }
    });

    return Array.from(uniqueAuthorsMap.values()).sort((a, b) =>
      a.author.localeCompare(b.author)
    );
  }, [currentPosts]);

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

  // Extract unique tags from current platform posts
  const availableTags = useMemo(() => {
    const uniqueTagsSet = new Set<string>();

    currentPosts.forEach((post) => {
      if (post.tags) {
        post.tags.forEach((tag) => {
          uniqueTagsSet.add(tag);
        });
      }
    });

    return Array.from(uniqueTagsSet).sort();
  }, [currentPosts]);

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
    let filtered = currentPosts;

    // Filter by authors
    if (selectedAuthors.length > 0) {
      filtered = filtered.filter((post) =>
        selectedAuthors.includes(post.username)
      );
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(
        (post) =>
          post.tags && post.tags.some((tag) => selectedTags.includes(tag))
      );
    }

    // Filter by time range or custom date range
    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter((post) => {
        if (!post.created_at) return false;
        const postTime = new Date(post.created_at);
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
        isWithinTimeRange(post.created_at, timeRange)
      );
    }

    return filtered;
  }, [
    currentPosts,
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
    // Only fetch if this platform hasn't been loaded yet
    if (!loadedPlatforms.has(selectedPlatform)) {
      fetchPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform, loadedPlatforms.size]);

  // Reset data and refetch when switching tabs
  useEffect(() => {
    // Clear current platform's data and reload
    setPlatformPosts((prev) => ({
      ...prev,
      [selectedPlatform]: [],
    }));
    // Reset offset when switching tabs
    setPlatformOffset((prev) => ({
      ...prev,
      [selectedPlatform]: 0,
    }));
    // Reset hasMore when switching tabs
    setPlatformHasMore((prev) => ({
      ...prev,
      [selectedPlatform]: true,
    }));
    setLoadedPlatforms((prev) => {
      const newSet = new Set(prev);
      newSet.delete(selectedPlatform);
      return newSet;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab]);

  // Reset filters when switching platforms
  useEffect(() => {
    setSelectedAuthors([]);
    setSelectedTags([]);
    setTimeRange("all");
    setDateRange(undefined);
  }, [selectedPlatform]);

  const getApiEndpoint = (platform: Platform): string => {
    // If tracking tab is selected, use the tracking API with platform filter
    if (selectedTab === "tracking") {
      const platformMap = {
        x: "TWITTER",
      };
      return `/api/kol-subscriptions/posts?platform=${platformMap[platform]}`;
    }

    // Default endpoints for "all" tab
    const endpoints = {
      x: "/api/tweets",
    };
    return endpoints[platform];
  };

  const fetchPosts = async (forceRefresh: boolean = false) => {
    try {
      // Set loading state for current platform
      setPlatformLoading((prev) => ({ ...prev, [selectedPlatform]: true }));
      setPlatformErrors((prev) => ({ ...prev, [selectedPlatform]: null }));

      // Reset offset when fetching fresh data
      setPlatformOffset((prev) => ({ ...prev, [selectedPlatform]: 0 }));

      const endpoint = getApiEndpoint(selectedPlatform);
      // Add pagination parameters for initial load
      const separator = endpoint.includes("?") ? "&" : "?";
      const paginatedEndpoint = `${endpoint}${separator}limit=${PAGE_SIZE}&offset=0`;

      const response = await fetch(paginatedEndpoint, {
        // Force refresh bypasses cache
        cache: forceRefresh ? "no-store" : "default",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }

      const data = await response.json();

      // Handle both API response structures (tweets property or direct array)
      const fetchedPosts = data.tweets || data.posts || [];

      // Update posts for current platform
      setPlatformPosts((prev) => ({
        ...prev,
        [selectedPlatform]: fetchedPosts,
      }));

      // Update hasMore for current platform
      setPlatformHasMore((prev) => ({
        ...prev,
        [selectedPlatform]: fetchedPosts.length >= PAGE_SIZE,
      }));

      // Mark this platform as loaded
      setLoadedPlatforms((prev) => new Set(prev).add(selectedPlatform));
    } catch (err) {
      setPlatformErrors((prev) => ({
        ...prev,
        [selectedPlatform]:
          err instanceof Error ? err.message : "An error occurred",
      }));
    } finally {
      setPlatformLoading((prev) => ({ ...prev, [selectedPlatform]: false }));
    }
  };

  // Function to refresh current platform data
  const refreshCurrentPlatform = () => {
    fetchPosts(true);
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const currentOffset = platformOffset[selectedPlatform];
      const newOffset = currentOffset + PAGE_SIZE;

      const endpoint = getApiEndpoint(selectedPlatform);
      // Add pagination parameters to the endpoint
      const separator = endpoint.includes("?") ? "&" : "?";
      const paginatedEndpoint = `${endpoint}${separator}limit=${PAGE_SIZE}&offset=${newOffset}`;

      const response = await fetch(paginatedEndpoint);

      if (!response.ok) {
        throw new Error("Failed to fetch more posts");
      }

      const data = await response.json();
      const fetchedPosts = data.tweets || data.posts || [];

      const currentPlatformPosts = platformPosts[selectedPlatform];
      const filteredNewPosts = fetchedPosts.filter(
        (newPost: KOLTweet) =>
          !currentPlatformPosts.some((post) => post.id === newPost.id)
      );

      // Update posts for current platform
      setPlatformPosts((prev) => ({
        ...prev,
        [selectedPlatform]: [...prev[selectedPlatform], ...filteredNewPosts],
      }));

      // Update offset for current platform
      setPlatformOffset((prev) => ({
        ...prev,
        [selectedPlatform]: newOffset,
      }));

      // Update hasMore based on whether we received a full page of results
      setPlatformHasMore((prev) => ({
        ...prev,
        [selectedPlatform]: fetchedPosts.length >= PAGE_SIZE,
      }));
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)}d`;
    }
  };

  const formatTweetText = (text: string) => {
    // Highlight hashtags and stock symbols
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

  // Memoize platform change handler to prevent recreating function on each render
  const handlePlatformChange = useCallback((val: string) => {
    setSelectedPlatform(val as Platform);
  }, []);

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
          {/* <SwitchTab
            options={PlatformTabOption}
            value={selectedPlatform}
            onValueChange={handlePlatformChange}
            size="md"
            variant="underline"
            className="w-auto"
          /> */}
        </div>
      }
      headerRightExtra={
        <div className="flex items-center gap-2 pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshCurrentPlatform}
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

      {filteredPosts.length === 0 && !isLoading && !currentError && (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <EmptyState
            title={
              selectedAuthors.length > 0 || selectedTags.length > 0
                ? "No posts match your filters"
                : "No posts available"
            }
            description={
              selectedAuthors.length > 0 || selectedTags.length > 0
                ? "Try adjusting your filters or clear them to see more posts."
                : "There are no posts to display at the moment."
            }
          />
        </div>
      )}

      {currentError && !isLoading && (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <ErrorState
            title="Failed to load posts"
            message={currentError}
            retry={refreshCurrentPlatform}
          />
        </div>
      )}

      <PostFeedList
        posts={filteredPosts}
        formatDate={formatDate}
        formatText={formatTweetText}
      />

      {/* Loading More Indicator */}
      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span>Loading more posts...</span>
          </div>
        </div>
      )}

      {/* No More Data Indicator */}
      {!hasMore && filteredPosts.length > 0 && (
        <div className="py-4 text-center text-xs text-gray-400 dark:text-white/30">
          No more posts to load
        </div>
      )}
    </SectionCard>
  );
}
