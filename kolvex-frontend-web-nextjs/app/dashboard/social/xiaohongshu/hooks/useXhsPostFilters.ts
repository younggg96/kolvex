import { useState, useMemo, useCallback } from "react";
import { XhsPost } from "@/lib/xhsApi";
import { DateRange } from "@/components/common/FilterSheet";

interface AuthorInfo {
  author: string;
  authorId: string;
  avatarUrl: string;
}

interface UseXhsPostFiltersOptions {
  posts: XhsPost[];
}

interface UseXhsPostFiltersReturn {
  selectedAuthors: string[];
  setSelectedAuthors: (authors: string[]) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  timeRange: string;
  setTimeRange: (range: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  availableAuthors: AuthorInfo[];
  availableTags: string[];
  filteredPosts: XhsPost[];
  activeFilterCount: number;
}

export function useXhsPostFilters({
  posts,
}: UseXhsPostFiltersOptions): UseXhsPostFiltersReturn {
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Extract unique authors from posts
  const availableAuthors = useMemo(() => {
    const uniqueAuthorsMap = new Map<string, AuthorInfo>();

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

  // Extract unique tags from posts
  const availableTags = useMemo(() => {
    const uniqueTagsSet = new Set<string>();

    posts.forEach((post) => {
      if (post.ai_tags) {
        post.ai_tags.forEach((tag) => uniqueTagsSet.add(tag));
      }
      if (post.tags) {
        post.tags.forEach((tag) => uniqueTagsSet.add(tag));
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

  // Filter posts
  const filteredPosts = useMemo(() => {
    let filtered = posts;

    if (selectedAuthors.length > 0) {
      filtered = filtered.filter((post) =>
        selectedAuthors.includes(post.author_id || "")
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(
        (post) =>
          (post.ai_tags &&
            post.ai_tags.some((tag) => selectedTags.includes(tag))) ||
          (post.tags && post.tags.some((tag) => selectedTags.includes(tag)))
      );
    }

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
  }, [posts, selectedAuthors, selectedTags, timeRange, dateRange, isWithinTimeRange]);

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
