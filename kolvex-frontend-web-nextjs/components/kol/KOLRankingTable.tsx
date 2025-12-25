"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { KolInfo } from "@/components/ui/kol-info";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Kol, SortBy } from "@/app/api/kols/route";
import { trackKOL, untrackKOL } from "@/lib/trackedKolApi";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/platformConfig";
import { SortableHeader } from "@/components/ui/sortable-header";
import { PlatformBadge } from "@/components/ui/platform-badge";
import SectionCard from "@/components/layout/SectionCard";

export const platformConfig = PLATFORM_CONFIG;

export interface KOLRankingTableProps {
  kols: Kol[];
  loading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  sortBy: SortBy | null;
  sortDirection: "asc" | "desc";
  onSort: (column: SortBy) => void;
  onLoadMore: () => void;
  onUpdate: () => void;
}

function KolTableSkeleton() {
  return (
    <TableRow className="border-b border-gray-100 dark:border-white/5">
      <TableCell className="py-3">
        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-white/10 animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center justify-start gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-white/10 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="w-24 h-3.5 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
            <div className="w-16 h-2.5 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="w-4 h-4 rounded bg-gray-200 dark:bg-white/10 animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3">
        <div className="w-8 h-3.5 rounded bg-gray-200 dark:bg-white/10 animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3">
        <div className="w-8 h-3.5 rounded bg-gray-200 dark:bg-white/10 animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3">
        <div className="w-10 h-3.5 rounded bg-gray-200 dark:bg-white/10 animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3 hidden xl:table-cell">
        <div className="w-16 h-3.5 rounded bg-gray-200 dark:bg-white/10 animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3">
        <div className="w-[60px] h-7 rounded bg-gray-200 dark:bg-white/10 animate-pulse mx-auto" />
      </TableCell>
    </TableRow>
  );
}

export default function KOLRankingTable({
  kols,
  loading = false,
  isLoadingMore = false,
  hasMore = true,
  sortBy,
  sortDirection,
  onSort,
  onLoadMore,
  onUpdate,
}: KOLRankingTableProps) {
  const [trackingStates, setTrackingStates] = useState<Record<string, boolean>>(
    () => {
      const states: Record<string, boolean> = {};
      kols.forEach((kol) => {
        states[kol.kol_id] = kol.user_tracked || false;
      });
      return states;
    }
  );
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {}
  );

  // Sync tracking states when kols change
  useEffect(() => {
    const states: Record<string, boolean> = {};
    kols.forEach((kol) => {
      states[kol.kol_id] = kol.user_tracked || false;
    });
    setTrackingStates((prev) => ({ ...prev, ...states }));
  }, [kols]);

  const handleTrackToggle = async (kol: Kol) => {
    const isTracked = trackingStates[kol.kol_id];
    setLoadingStates((prev) => ({ ...prev, [kol.kol_id]: true }));

    try {
      if (isTracked) {
        await untrackKOL(kol.kol_id, kol.platform);
        setTrackingStates((prev) => ({ ...prev, [kol.kol_id]: false }));
        toast.success(`Untracked ${kol.display_name}`);
      } else {
        await trackKOL({
          kol_id: kol.kol_id,
          platform: kol.platform,
          notify: true,
        });
        setTrackingStates((prev) => ({ ...prev, [kol.kol_id]: true }));
        toast.success(`Now tracking ${kol.display_name}`);
      }
      onUpdate();
    } catch (error: any) {
      console.error("Error toggling track status:", error);
      toast.error(error.message || "Failed to update tracking status");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [kol.kol_id]: false }));
    }
  };

  const formatNumber = (num: number | undefined | null): string => {
    const value = num ?? 0;
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
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

  const handleSort = (column: string) => {
    onSort(column as SortBy);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore || isLoadingMore) return;

    const target = e.currentTarget;
    const scrollPercentage =
      (target.scrollTop + target.clientHeight) / target.scrollHeight;

    // Load more when scrolled to 90% of the content
    if (scrollPercentage > 0.9) {
      onLoadMore();
    }
  };

  return (
    <div className="space-y-3">
      {/* Loading State - Mobile */}
      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && kols.length === 0 && (
        <EmptyState
          title="No KOLs found"
          description={"No KOLs found. Try again later."}
        />
      )}

      {/* Mobile Card View */}
      {!loading && kols.length > 0 && (
        <div
          className="space-y-2 overflow-auto md:hidden"
          onScroll={handleScroll}
        >
          {kols.map((kol, index) => (
            <div
              key={kol.id}
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

                <KolInfo
                  avatarUrl={kol.avatar_url}
                  name={kol.display_name}
                  username={kol.username}
                  platform={kol.platform}
                  verified={kol.verified}
                />
              </div>

              {/* Key Stats - Only 2 most important metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5 font-medium">
                    Influence
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {(kol.influence_score ?? 0).toFixed(1)}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5 font-medium">
                    Followers
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatNumber(kol.followers_count)}
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
          {!hasMore && kols.length > 0 && !isLoadingMore && (
            <div className="text-center py-3 text-xs text-gray-400 dark:text-white/40">
              No more data
            </div>
          )}
        </div>
      )}

      {/* Desktop Table View */}
      {(kols.length > 0 || loading) && (
        <SectionCard
          padding="none"
          useSectionHeader={false}
          className="hidden md:block"
        >
          <div
            className="max-h-[600px] overflow-x-auto"
            onScroll={handleScroll}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs text-center w-12 font-semibold">
                    Rank
                  </TableHead>
                  <TableHead className="text-xs text-left font-semibold">
                    KOL
                  </TableHead>
                  <TableHead className="text-xs text-center font-semibold">
                    Platform
                  </TableHead>
                  <SortableHeader
                    label="Influence"
                    sortKey="influence_score"
                    currentSortKey={sortBy}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    type="numeric"
                  />
                  <SortableHeader
                    label="Trending"
                    sortKey="trending_score"
                    currentSortKey={sortBy}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    type="numeric"
                  />
                  <SortableHeader
                    label="Followers"
                    sortKey="followers_count"
                    currentSortKey={sortBy}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    type="amount"
                  />
                  <TableHead className="text-xs text-center font-semibold hidden xl:table-cell">
                    Last Post
                  </TableHead>
                  <TableHead className="text-xs text-center font-semibold">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(10)].map((_, i) => <KolTableSkeleton key={i} />)
                ) : (
                  <>
                    {kols.map((kol, index) => (
                      <TableRow
                        key={kol.id}
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

                        {/* KOL */}
                        <TableCell className="py-3">
                          <KolInfo
                            avatarUrl={kol.avatar_url}
                            name={kol.display_name}
                            username={kol.username}
                            platform={kol.platform}
                            verified={kol.verified}
                            showPlatformBadge={false}
                            category={kol.category}
                          />
                        </TableCell>

                        {/* Platform */}
                        <TableCell className="py-3">
                          <div className="flex items-center justify-center">
                            <PlatformBadge platform={kol.platform} size="sm" />
                          </div>
                        </TableCell>

                        {/* Influence Score */}
                        <TableCell className="text-xs text-center font-bold text-gray-900 dark:text-white py-3">
                          {(kol.influence_score ?? 0).toFixed(1)}
                        </TableCell>

                        {/* Trending Score */}
                        <TableCell className="text-xs text-center font-bold text-gray-900 dark:text-white py-3">
                          {(kol.trending_score ?? 0).toFixed(1)}
                        </TableCell>

                        {/* Followers */}
                        <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3">
                          {formatNumber(kol.followers_count)}
                        </TableCell>

                        {/* Last Post */}
                        <TableCell className="text-xs text-center text-gray-600 dark:text-white/60 font-medium py-3 hidden xl:table-cell">
                          {formatDate(kol.last_post_at)}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-center py-3">
                          <Button
                            variant={
                              trackingStates[kol.kol_id] ? "default" : "outline"
                            }
                            size="xs"
                            onClick={() => handleTrackToggle(kol)}
                            disabled={loadingStates[kol.kol_id]}
                            className={`min-w-[80px] transition-all text-xs !border-yellow-500 ${
                              trackingStates[kol.kol_id]
                                ? "bg-yellow-500 hover:bg-yellow-500/90 text-white shadow-sm"
                                : "border-yellow-500 hover:bg-yellow-500/40 text-yellow-500"
                            }`}
                          >
                            {loadingStates[kol.kol_id] ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Loading
                              </>
                            ) : trackingStates[kol.kol_id] ? (
                              <>
                                <Star className="w-3.5 h-3.5 mr-1.5 fill-yellow-500" />
                                Tracking
                              </>
                            ) : (
                              <>
                                <Star className="w-3.5 h-3.5 mr-1.5 text-yellow-500" />
                                Track
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Loading More Indicator */}
                    {isLoadingMore && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6">
                          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading more KOLs...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* No More Data Indicator */}
                    {!hasMore && kols.length > 0 && !isLoadingMore && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-6 text-sm text-gray-400 dark:text-white/40 font-medium"
                        >
                          No more KOLs to load
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
