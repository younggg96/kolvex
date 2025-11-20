"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { useBreakpoints } from "@/hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingTopic, Platform } from "@/lib/supabase/database.types";
import {
  TrendingUp,
  Hash,
  MessageSquare,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORM_CONFIG } from "@/lib/platformConfig";
import { SearchInput } from "@/components/ui/search-input";

interface TrendingTopicsTableProps {
  topics: TrendingTopic[];
  onUpdate?: () => void;
  loading?: boolean;
}

// Format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

export default function TrendingTopicsTable({
  topics,
  onUpdate,
  loading = false,
}: TrendingTopicsTableProps) {
  const { isMobile } = useBreakpoints();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");
  const [filterTopicType, setFilterTopicType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "trending_score" | "mention_count" | "engagement_score"
  >("trending_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Prevent hydration mismatch by only using isMobile after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter and sort topics
  const filteredAndSortedTopics = useMemo(() => {
    let filtered = topics.filter((topic) => {
      // Search filter
      const matchesSearch = topic.topic
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      // Platform filter
      const matchesPlatform =
        filterPlatform === "all" || topic.platform === filterPlatform;

      // Topic type filter
      const matchesTopicType =
        filterTopicType === "all" || topic.topic_type === filterTopicType;

      return matchesSearch && matchesPlatform && matchesTopicType;
    });

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      const multiplier = sortDirection === "asc" ? 1 : -1;
      return ((aValue || 0) - (bValue || 0)) * multiplier;
    });

    return filtered;
  }, [
    topics,
    searchTerm,
    filterPlatform,
    filterTopicType,
    sortBy,
    sortDirection,
  ]);

  // Toggle sort direction
  const handleSort = (
    field: "trending_score" | "mention_count" | "engagement_score"
  ) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  };

  // Get sort icon based on current sort state
  const getSortIcon = (
    field: "trending_score" | "mention_count" | "engagement_score"
  ) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {/* Filters Skeleton */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center mt-2">
          <Skeleton className="h-8 w-full sm:flex-1" />
          <Skeleton className="h-8 w-full sm:w-[150px]" />
          <Skeleton className="h-8 w-full sm:w-[150px]" />
        </div>

        {/* Table/Cards Skeleton */}
        {isMounted && isMobile ? (
          // Mobile Cards Skeleton
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="border border-border-light dark:border-border-dark rounded-lg p-3 bg-card-light dark:bg-card-dark"
              >
                <div className="flex items-start justify-between mb-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-4" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop Table Skeleton
          <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Topic</TableHead>
                  <TableHead className="text-xs">Platform</TableHead>
                  <TableHead className="text-xs text-center">
                    Mentions
                  </TableHead>
                  <TableHead className="text-xs text-center">
                    Engagement
                  </TableHead>
                  <TableHead className="text-xs text-center">
                    Trending
                  </TableHead>
                  <TableHead className="text-xs">Related Stocks</TableHead>
                  <TableHead className="text-xs text-center">
                    Last Seen
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-12 mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-10 mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-10 mx-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-12" />
                        <Skeleton className="h-5 w-12" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-3 w-16 mx-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center mt-2">
        <SearchInput
          placeholder="Search topics..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="text-xs"
        />
        <Select
          value={filterPlatform}
          onValueChange={(value) =>
            setFilterPlatform(value as Platform | "all")
          }
        >
          <SelectTrigger className="w-full sm:w-[150px] text-xs">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="TWITTER">X (Twitter)</SelectItem>
            <SelectItem value="REDDIT">Reddit</SelectItem>
            <SelectItem value="REDNOTE">Rednote</SelectItem>
            <SelectItem value="YOUTUBE">YouTube</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterTopicType}
          onValueChange={(value) => setFilterTopicType(value)}
        >
          <SelectTrigger className="w-full sm:w-[150px] text-xs">
            <SelectValue placeholder="Topic Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="hashtag">Hashtag</SelectItem>
            <SelectItem value="keyword">Keyword</SelectItem>
            <SelectItem value="mention">Mention</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile Card View */}
      {isMounted && isMobile ? (
        <div className="space-y-2">
          {filteredAndSortedTopics.length === 0 ? (
            <div className="text-center py-8 border border-border-light dark:border-border-dark rounded-lg">
              <p className="text-xs text-gray-500 dark:text-white/50">
                {topics.length === 0
                  ? "No trending topics data"
                  : "No topics match your criteria"}
              </p>
            </div>
          ) : (
            filteredAndSortedTopics.map((topic) => (
              <div
                key={topic.id}
                className="border border-border-light dark:border-border-dark rounded-lg p-3 bg-card-light dark:bg-card-dark"
              >
                {/* Header with Topic and Platform */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Hash className="w-3.5 h-3.5 text-gray-500 dark:text-white/50 flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {topic.topic}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <Image
                      src={PLATFORM_CONFIG[topic.platform].icon}
                      alt={PLATFORM_CONFIG[topic.platform].name}
                      width={16}
                      height={16}
                      className="opacity-70"
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-white/50">
                      Mentions
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatNumber(topic.mention_count)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-white/50">
                      Engagement
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {topic.engagement_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-white/50">
                      Trending
                    </span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {topic.trending_score.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Related Tickers */}
                {topic.related_tickers && topic.related_tickers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {topic.related_tickers.slice(0, 3).map((ticker) => (
                      <span
                        key={ticker}
                        className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs"
                      >
                        ${ticker}
                      </span>
                    ))}
                    {topic.related_tickers.length > 3 && (
                      <span className="text-xs text-gray-500 dark:text-white/50">
                        +{topic.related_tickers.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Last Seen */}
                {topic.last_seen_at && (
                  <div className="text-xs text-gray-500 dark:text-white/50 mt-2">
                    {formatDistanceToNow(new Date(topic.last_seen_at), {
                      addSuffix: true,
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="border border-border-light dark:border-border-dark rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Topic</TableHead>
                <TableHead className="text-xs font-semibold">
                  Platform
                </TableHead>
                <TableHead className="text-xs text-center font-semibold">
                  <div className="flex items-center justify-center gap-1">
                    <span>Mentions</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleSort("mention_count")}
                      className="!px-1 !py-0 hover:bg-gray-200 dark:hover:bg-white/20"
                    >
                      {getSortIcon("mention_count")}
                    </Button>
                  </div>
                </TableHead>
                <TableHead className="text-xs text-center font-semibold">
                  <div className="flex items-center justify-center gap-1">
                    <span>Engagement</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleSort("engagement_score")}
                      className="!px-1 !py-0 hover:bg-gray-200 dark:hover:bg-white/20"
                    >
                      {getSortIcon("engagement_score")}
                    </Button>
                  </div>
                </TableHead>
                <TableHead className="text-xs text-center font-semibold">
                  <div className="flex items-center justify-center gap-1">
                    <span>Trending</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleSort("trending_score")}
                      className="!px-1 !py-0 hover:bg-gray-200 dark:hover:bg-white/20"
                    >
                      {getSortIcon("trending_score")}
                    </Button>
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold">
                  Related Stocks
                </TableHead>
                <TableHead className="text-xs text-center font-semibold">
                  Last Seen
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedTopics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-xs text-gray-500 dark:text-white/50">
                      {topics.length === 0
                        ? "No trending topics data"
                        : "No topics match your criteria"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedTopics.map((topic) => (
                  <TableRow key={topic.id}>
                    <TableCell className="text-xs font-medium">
                      <span className="max-w-[200px] truncate">
                        {topic.topic}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Image
                          src={PLATFORM_CONFIG[topic.platform].icon}
                          alt={PLATFORM_CONFIG[topic.platform].name}
                          width={16}
                          height={16}
                          className="opacity-70"
                        />
                        <span className="text-xs hidden xl:inline">
                          {PLATFORM_CONFIG[topic.platform].name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MessageSquare className="w-3 h-3 text-gray-500 dark:text-white/50" />
                        {formatNumber(topic.mention_count)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {topic.engagement_score.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {topic.trending_score.toFixed(1)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {topic.related_tickers &&
                        topic.related_tickers.length > 0 ? (
                          <>
                            {topic.related_tickers.slice(0, 3).map((ticker) => (
                              <span
                                key={ticker}
                                className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs"
                              >
                                ${ticker}
                              </span>
                            ))}
                            {topic.related_tickers.length > 3 && (
                              <span className="text-xs text-gray-500 dark:text-white/50">
                                +{topic.related_tickers.length - 3}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 dark:text-white/30">
                            -
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center text-gray-500 dark:text-white/50">
                      {topic.last_seen_at
                        ? formatDistanceToNow(new Date(topic.last_seen_at), {
                            addSuffix: true,
                          })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      {filteredAndSortedTopics.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white/50">
          <span>
            Showing {filteredAndSortedTopics.length} / {topics.length} topics
          </span>
        </div>
      )}
    </div>
  );
}
