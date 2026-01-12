import { useState, useMemo, useCallback } from "react";
import { KOLPost } from "@/lib/kolPostsApi";
import { DateRange } from "@/components/common/FilterSheet";

// Author info type
interface AuthorInfo {
  author: string;
  authorId: string;
  avatarUrl: string;
}

// Tag option type
interface TagOption {
  label: string;
  value: string;
}

interface UsePostFiltersOptions {
  posts: KOLPost[];
}

interface UsePostFiltersReturn {
  // Filter states
  selectedAuthors: string[];
  setSelectedAuthors: (authors: string[]) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  timeRange: string;
  setTimeRange: (range: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  
  // Filter options (raw data for parent component to create JSX)
  availableAuthors: AuthorInfo[];
  availableTags: string[];
  
  // Filtered data
  filteredPosts: KOLPost[];
  activeFilterCount: number;
}

export function usePostFilters({
  posts,
}: UsePostFiltersOptions): UsePostFiltersReturn {
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Extract unique authors from posts
  const availableAuthors = useMemo(() => {
    const uniqueAuthorsMap = new Map<
      string,
      { author: string; authorId: string; avatarUrl: string }
    >();

    posts.forEach((post) => {
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
  }, [posts]);

  // Extract unique tags from posts
  const availableTags = useMemo(() => {
    const uniqueTagsSet = new Set<string>();

    posts.forEach((post) => {
      if (post.tags) {
        post.tags.forEach((tag) => {
          uniqueTagsSet.add(tag);
        });
      }
    });

    return Array.from(uniqueTagsSet).sort();
  }, [posts]);

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

  return {
    selectedAuthors,
    setSelectedAuthors,
    selectedTags,
    setSelectedTags,
    timeRange,
    setTimeRange,
    dateRange,
    setDateRange,
    availableAuthors,
    availableTags,
    filteredPosts,
    activeFilterCount,
  };
}
