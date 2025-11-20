"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { CardSkeleton } from "./LoadingSkeleton";
import { EmptyState } from "./EmptyState";
import { Creator, SortBy } from "@/app/api/creators/route";
import type { Platform } from "@/lib/supabase/database.types";
import { trackKOL, untrackKOL } from "@/lib/trackedKolApi";
import { toast } from "sonner";
import {
  Star,
  TrendingUp,
  Users,
  MessageSquare,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  Check,
  Plus,
  Loader2,
} from "lucide-react";
import { useBreakpoints } from "@/hooks";
import { PLATFORM_CONFIG } from "@/lib/platformConfig";
import { SearchInput } from "@/components/ui/search-input";

interface TopCreatorsProps {
  limit?: number;
  platform?: Platform;
  showFilters?: boolean;
  enableInfiniteScroll?: boolean;
  maxHeight?: string;
}

export const platformConfig = PLATFORM_CONFIG;

const sortOptions: { value: SortBy; label: string; icon: React.ReactNode }[] = [
  {
    value: "influence_score",
    label: "Influence Score",
    icon: <Star className="w-3.5 h-3.5" />,
  },
  {
    value: "trending_score",
    label: "Trending Score",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  {
    value: "followers_count",
    label: "Followers",
    icon: <Users className="w-3.5 h-3.5" />,
  },
  {
    value: "total_posts_count",
    label: "Total Posts",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
  {
    value: "avg_engagement_rate",
    label: "Engagement Rate",
    icon: <Activity className="w-3.5 h-3.5" />,
  },
];

export default function TopCreators({
  limit = 20,
  platform,
  showFilters = true,
  enableInfiniteScroll = true,
  maxHeight = "600px",
}: TopCreatorsProps) {
  const { isMobile } = useBreakpoints();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("influence_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "all">(
    platform || "all"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [trackingStates, setTrackingStates] = useState<Record<string, boolean>>(
    {}
  );
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {}
  );
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    // Reset and fetch when sort or platform changes
    setCreators([]);
    setOffset(0);
    setHasMore(true);
    fetchCreators(true);
  }, [sortBy, sortDirection, selectedPlatform]);

  const fetchCreators = async (reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString(),
        sort_by: sortBy,
        sort_direction: sortDirection,
      });

      if (selectedPlatform !== "all") {
        params.append("platform", selectedPlatform);
      }

      const response = await fetch(`/api/creators?${params}`);
      if (!response.ok) throw new Error("Failed to fetch creators");

      const data = await response.json();
      const newCreators = data.creators || [];

      if (reset) {
        setCreators(newCreators);
      } else {
        setCreators((prev) => [...prev, ...newCreators]);
      }

      // Check if there are more items to load
      setHasMore(newCreators.length === limit);
      setOffset(currentOffset + newCreators.length);

      // Initialize/update tracking states
      const states: Record<string, boolean> = {};
      newCreators.forEach((creator: Creator) => {
        states[creator.creator_id] = creator.user_tracked || false;
      });
      setTrackingStates((prev) => ({ ...prev, ...states }));
    } catch (error) {
      console.error("Error fetching creators:", error);
      toast.error("Failed to load creators");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleTrackToggle = async (creator: Creator) => {
    const isTracked = trackingStates[creator.creator_id];
    setLoadingStates((prev) => ({ ...prev, [creator.creator_id]: true }));

    try {
      if (isTracked) {
        await untrackKOL(creator.creator_id, creator.platform);
        setTrackingStates((prev) => ({ ...prev, [creator.creator_id]: false }));
        toast.success(`Untracked ${creator.display_name}`);
      } else {
        await trackKOL({
          kol_id: creator.creator_id,
          platform: creator.platform,
          notify: true,
        });
        setTrackingStates((prev) => ({ ...prev, [creator.creator_id]: true }));
        toast.success(`Now tracking ${creator.display_name}`);
      }
    } catch (error: any) {
      console.error("Error toggling track status:", error);
      toast.error(error.message || "Failed to update tracking status");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [creator.creator_id]: false }));
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      // Toggle direction if clicking the same column
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      // Set new column with default desc direction
      setSortBy(column);
      setSortDirection("desc");
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!enableInfiniteScroll || !hasMore || isLoadingMore) return;

    const target = e.currentTarget;
    const scrollPercentage =
      (target.scrollTop + target.clientHeight) / target.scrollHeight;

    // Load more when scrolled to 90% of the content
    if (scrollPercentage > 0.9) {
      fetchCreators(false);
    }
  };

  const getSortIcon = (column: SortBy) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    }
    return sortDirection === "desc" ? (
      <ArrowDown className="w-3 h-3" />
    ) : (
      <ArrowUp className="w-3 h-3" />
    );
  };

  // Client-side search filtering
  const filteredCreators = useMemo(() => {
    if (!searchTerm.trim()) {
      return creators;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    return creators.filter(
      (creator) =>
        creator.display_name.toLowerCase().includes(lowerSearchTerm) ||
        creator.username?.toLowerCase().includes(lowerSearchTerm) ||
        creator.creator_id.toLowerCase().includes(lowerSearchTerm)
    );
  }, [creators, searchTerm]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Input */}
          <SearchInput
            type="text"
            placeholder="Search KOLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortBy)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.icon}
                    <span className="text-xs">{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!platform && (
            <Select
              value={selectedPlatform}
              onValueChange={(value) =>
                setSelectedPlatform(value as Platform | "all")
              }
            >
              <SelectTrigger className="w-full sm:w-[150px] text-xs">
                <SelectValue>
                  <span className="text-xs">All Platforms</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="text-xs">All Platforms</span>
                </SelectItem>
                <SelectItem value="TWITTER">
                  <span className="text-xs">X (Twitter)</span>
                </SelectItem>
                <SelectItem value="REDDIT">
                  <span className="text-xs">Reddit</span>
                </SelectItem>
                <SelectItem value="YOUTUBE">
                  <span className="text-xs">YouTube</span>
                </SelectItem>
                <SelectItem value="REDNOTE">
                  <span className="text-xs">Rednote</span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredCreators.length === 0 && (
        <EmptyState
          title="No creators found"
          description={
            searchTerm
              ? "No creators match your search. Try a different search term."
              : "Try adjusting your filters to see more results."
          }
        />
      )}

      {/* Mobile Card View */}
      {!isLoading && filteredCreators.length > 0 && isMobile && (
        <div
          className="space-y-2 overflow-auto"
          style={{ maxHeight }}
          onScroll={handleScroll}
        >
          {filteredCreators.map((creator, index) => (
            <div
              key={creator.id}
              className="border border-gray-200 dark:border-white/10 rounded-lg p-2 hover:shadow-sm transition-shadow"
            >
              {/* Header: Rank + Avatar + Name + Track Button */}
              <div className="flex items-center gap-2.5 mb-2.5">
                {/* Rank Badge */}
                <div
                  className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                    index === 0
                      ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500"
                      : index === 1
                      ? "bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400"
                      : index === 2
                      ? "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-500"
                      : "text-gray-400 dark:text-white/40"
                  }`}
                >
                  {index + 1}
                </div>

                {/* Avatar */}
                {creator.avatar_url ? (
                  <Image
                    src={creator.avatar_url}
                    alt={creator.display_name}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full flex-shrink-0 ring-1 ring-gray-200 dark:ring-white/10"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {creator.display_name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-row gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {creator.display_name}
                      </h3>
                      {creator.verified && (
                        <CheckCircle className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    {creator.username && (
                      <p className="text-[10px] text-gray-500 dark:text-white/50 truncate">
                        @{creator.username}
                      </p>
                    )}
                  </div>
                  {/* Platform Badge */}
                  <div className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 rounded-full px-2.5 py-1 mb-2.5">
                    <Image
                      src={platformConfig[creator.platform].icon}
                      alt={platformConfig[creator.platform].name}
                      width={14}
                      height={14}
                      className="opacity-80"
                    />
                  </div>
                </div>

                {/* Track Button */}
                <Button
                  variant={
                    trackingStates[creator.creator_id] ? "default" : "outline"
                  }
                  size="xs"
                  onClick={() => handleTrackToggle(creator)}
                  disabled={loadingStates[creator.creator_id]}
                  className={`flex-shrink-0 min-w-[50px] ${
                    trackingStates[creator.creator_id]
                      ? "bg-primary hover:bg-primary/90 text-white"
                      : "border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                  }`}
                >
                  {loadingStates[creator.creator_id] ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : trackingStates[creator.creator_id] ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>

              {/* Key Stats - Only 2 most important metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5 font-medium">
                    Influence
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {creator.influence_score.toFixed(1)}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5 font-medium">
                    Followers
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatNumber(creator.followers_count)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Loading More Indicator */}
          {isLoadingMore && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span>Loading...</span>
              </div>
            </div>
          )}

          {/* No More Data Indicator */}
          {!hasMore && filteredCreators.length > 0 && !isLoadingMore && (
            <div className="text-center py-3 text-xs text-gray-400 dark:text-white/40">
              No more data
            </div>
          )}
        </div>
      )}

      {/* Desktop Table View */}
      {!isLoading && filteredCreators.length > 0 && !isMobile && (
        <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
          <div
            className="overflow-auto"
            style={{ maxHeight }}
            onScroll={handleScroll}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 backdrop-blur">
                <TableRow className="border-b border-gray-200 dark:border-white/10">
                  <TableHead className="text-xs text-center w-12 font-semibold">
                    Rank
                  </TableHead>
                  <TableHead className="text-xs text-left font-semibold">
                    Creator
                  </TableHead>
                  <TableHead className="text-xs text-center font-semibold">
                    Platform
                  </TableHead>
                  <TableHead className="text-xs text-center font-semibold">
                    <div className="flex items-center justify-center gap-1">
                      <span>Influence</span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleSort("influence_score")}
                        className="!px-1 !py-0 hover:bg-gray-200 dark:hover:bg-white/20"
                      >
                        {getSortIcon("influence_score")}
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
                  <TableHead className="text-xs text-center font-semibold">
                    <div className="flex items-center justify-center gap-1">
                      <span>Followers</span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleSort("followers_count")}
                        className="!px-1 !py-0 hover:bg-gray-200 dark:hover:bg-white/20"
                      >
                        {getSortIcon("followers_count")}
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className="text-xs text-center font-semibold hidden md:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      <span>Posts</span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleSort("total_posts_count")}
                        className="!px-1 !py-0 hover:bg-gray-200 dark:hover:bg-white/20"
                      >
                        {getSortIcon("total_posts_count")}
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className="text-xs text-center font-semibold hidden lg:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      <span>Engagement</span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleSort("avg_engagement_rate")}
                        className="!px-1 !py-0 hover:bg-gray-200 dark:hover:bg-white/20"
                      >
                        {getSortIcon("avg_engagement_rate")}
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className="text-xs text-center font-semibold hidden xl:table-cell">
                    Last Post
                  </TableHead>
                  <TableHead className="text-xs text-center font-semibold">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCreators.map((creator, index) => (
                  <TableRow
                    key={creator.id}
                    className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5"
                  >
                    {/* Rank */}
                    <TableCell className="text-xs font-bold text-center py-3">
                      <div
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          index === 0
                            ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500"
                            : index === 1
                            ? "bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400"
                            : index === 2
                            ? "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-500"
                            : "text-gray-500 dark:text-white/50"
                        }`}
                      >
                        {index + 1}
                      </div>
                    </TableCell>

                    {/* Creator */}
                    <TableCell className="py-3">
                      <div className="flex items-center justify-start gap-2.5">
                        {creator.avatar_url ? (
                          <Image
                            src={creator.avatar_url}
                            alt={creator.display_name}
                            width={36}
                            height={36}
                            className="w-9 h-9 rounded-full ring-2 ring-gray-100 dark:ring-white/10 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-gray-100 dark:ring-white/10 flex-shrink-0">
                            {creator.display_name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {creator.display_name}
                            </div>
                            {creator.verified && (
                              <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          {creator.username && (
                            <div className="text-[11px] text-gray-500 dark:text-white/50 truncate">
                              @{creator.username}
                            </div>
                          )}
                          {creator.category && (
                            <span className="inline-block text-[10px] text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded mt-0.5">
                              {creator.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Platform */}
                    <TableCell className="py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Image
                          src={platformConfig[creator.platform].icon}
                          alt={platformConfig[creator.platform].name}
                          width={16}
                          height={16}
                          className="opacity-80"
                        />
                      </div>
                    </TableCell>

                    {/* Influence Score */}
                    <TableCell className="text-xs text-center font-bold text-gray-900 dark:text-white py-3">
                      {creator.influence_score.toFixed(1)}
                    </TableCell>

                    {/* Trending Score */}
                    <TableCell className="text-xs text-center font-bold text-gray-900 dark:text-white py-3">
                      {creator.trending_score.toFixed(1)}
                    </TableCell>

                    {/* Followers */}
                    <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3">
                      {formatNumber(creator.followers_count)}
                    </TableCell>

                    {/* Total Posts */}
                    <TableCell className="text-xs text-center font-medium text-gray-700 dark:text-white/80 py-3 hidden md:table-cell">
                      {formatNumber(creator.total_posts_count)}
                    </TableCell>

                    {/* Engagement Rate */}
                    <TableCell className="text-xs text-center font-medium text-gray-700 dark:text-white/80 py-3 hidden lg:table-cell">
                      {creator.avg_engagement_rate.toFixed(2)}%
                    </TableCell>

                    {/* Last Post */}
                    <TableCell className="text-xs text-center text-gray-600 dark:text-white/60 font-medium py-3 hidden xl:table-cell">
                      {formatDate(creator.last_post_at)}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-center py-3">
                      <Button
                        variant={
                          trackingStates[creator.creator_id]
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => handleTrackToggle(creator)}
                        disabled={loadingStates[creator.creator_id]}
                        className={`min-w-[80px] font-medium transition-all ${
                          trackingStates[creator.creator_id]
                            ? "bg-primary hover:bg-primary/90 text-white shadow-sm"
                            : "border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                        }`}
                      >
                        {loadingStates[creator.creator_id]
                          ? "Loading..."
                          : trackingStates[creator.creator_id]
                          ? "Tracking"
                          : "Track"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Loading More Indicator */}
                {isLoadingMore && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6">
                      <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading more creators...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* No More Data Indicator */}
                {!hasMore && filteredCreators.length > 0 && !isLoadingMore && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-6 text-sm text-gray-400 dark:text-white/40 font-medium"
                    >
                      No more creators to load
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
