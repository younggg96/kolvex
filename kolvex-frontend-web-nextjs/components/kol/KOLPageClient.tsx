"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import KOLTrackerTable from "@/components/kol/KOLTrackerTable";
import { SwitchTab } from "@/components/ui/switch-tab";
import { KOL } from "@/lib/kolApi";
import { Kol, SortBy } from "@/app/api/kols/route";
import { Star, TrendingUp } from "lucide-react";
import { useTrackedKOLs } from "@/hooks";
import { KOLHeroSection } from "./KOLHeroSection";
import KOLRankingTable from "@/components/kol/KOLRankingTable";
import { toast } from "sonner";

export default function KOLPageClient() {
  const [activeTab, setActiveTab] = useState<"trackingKOLs" | "ranking">(
    "ranking"
  );

  // Use the trackingKOLs hook to get real data from the API
  const {
    trackedKOLs: apiTrackingKOLs,
    isLoading: isLoadingTrackingKOLs,
    refresh: refreshTrackingKOLs,
  } = useTrackedKOLs();

  // Ranking KOLs state
  const [rankingKols, setRankingKols] = useState<Kol[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Fetch ranking KOLs
  const fetchRankingKols = useCallback(
    async (reset: boolean = false) => {
      try {
        if (reset) {
          setIsLoadingRanking(true);
        } else {
          setIsLoadingMore(true);
        }

        const currentOffset = reset ? 0 : offset;
        const params = new URLSearchParams({
          limit: "20",
          offset: currentOffset.toString(),
          sort_by: sortBy || "influence_score",
          sort_direction: sortDirection,
        });

        const response = await fetch(`/api/kols?${params}`);
        if (!response.ok) throw new Error("Failed to fetch kols");

        const data = await response.json();
        const newKols = data.kols || [];

        if (reset) {
          setRankingKols(newKols);
        } else {
          setRankingKols((prev) => [...prev, ...newKols]);
        }

        // Check if there are more items to load
        setHasMore(newKols.length === 20);
        setOffset(currentOffset + newKols.length);
      } catch (error) {
        console.error("Error fetching kols:", error);
        toast.error("Failed to load KOLs");
      } finally {
        setIsLoadingRanking(false);
        setIsLoadingMore(false);
      }
    },
    [offset, sortBy, sortDirection]
  );

  // Reset and fetch when sort changes
  useEffect(() => {
    setRankingKols([]);
    setOffset(0);
    setHasMore(true);
    fetchRankingKols(true);
  }, [sortBy, sortDirection]);

  // Refresh ranking data
  const refreshRankingKols = useCallback(() => {
    setRankingKols([]);
    setOffset(0);
    setHasMore(true);
    fetchRankingKols(true);
  }, [fetchRankingKols]);

  // Handle sort change
  const handleSort = useCallback(
    (column: SortBy) => {
      if (sortBy === column) {
        // Toggle sequence: desc -> asc -> default (null)
        if (sortDirection === "desc") {
          setSortDirection("asc");
        } else {
          // If current is asc, reset to default (null)
          setSortBy(null);
          setSortDirection("desc");
        }
      } else {
        // Set new column with default desc direction
        setSortBy(column);
        setSortDirection("desc");
      }
    },
    [sortBy, sortDirection]
  );

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchRankingKols(false);
    }
  }, [isLoadingMore, hasMore, fetchRankingKols]);

  // Convert trackingKOLs to KOL format for compatibility with KOLTrackerTable
  const convertedTrackingKOLs = useMemo<KOL[]>(() => {
    return apiTrackingKOLs.map((tracking) => {
      // Map platform types from database format to KOL API format
      const platformMap: {
        [key: string]: "twitter" | "reddit" | "youtube" | "rednote";
      } = {
        TWITTER: "twitter",
        REDDIT: "reddit",
        YOUTUBE: "youtube",
        REDNOTE: "rednote",
      };

      return {
        id: tracking.kol_id, // Use kol_id directly as ID
        name: tracking.kol_name || tracking.kol_id,
        username: tracking.kol_username || tracking.kol_id,
        platform: platformMap[tracking.platform],
        followers: tracking.kol_followers_count || 0,
        description: tracking.kol_bio || "-",
        avatarUrl: tracking.kol_avatar_url || undefined,
        isTracking: true,
        createdAt: tracking.updated_at,
        updatedAt: tracking.updated_at,
      };
    });
  }, [apiTrackingKOLs]);

  // Reload trackingKOLs KOLs when switching to the trackingKOLs tab
  useEffect(() => {
    if (activeTab === "trackingKOLs") {
      refreshTrackingKOLs();
    }
  }, [activeTab, refreshTrackingKOLs]);

  // Tab options - use useMemo to avoid recreating on every render
  const tabOptions = useMemo(
    () => [
      {
        value: "ranking",
        label: "Top Ranking",
        icon: <TrendingUp className="w-3.5 h-3.5" />,
      },
      {
        value: "trackingKOLs",
        label: "Tracking KOLs",
        icon: <Star className="w-3.5 h-3.5" />,
      },
    ],
    []
  );

  return (
    <DashboardLayout
      title={
        activeTab === "trackingKOLs" ? "Tracking KOLs" : "Top Ranking KOLs"
      }
      headerClassName="lg:hidden"
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark h-full">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="hidden lg:block">
          <KOLHeroSection />
        </div>
        <div className="relative p-4 min-w-0 space-y-6">
          {/* KOL Table with Tab Switcher */}
          <SectionCard
            useSectionHeader
            padding="sm"
            contentClassName="px-3 pb-3"
            headerExtra={
              <SwitchTab
                options={tabOptions}
                value={activeTab}
                onValueChange={(value) =>
                  setActiveTab(value as "trackingKOLs" | "ranking")
                }
                size="md"
                variant="pills"
              />
            }
          >
            {activeTab === "trackingKOLs" ? (
              <KOLTrackerTable
                kols={convertedTrackingKOLs}
                onUpdate={refreshTrackingKOLs}
                loading={isLoadingTrackingKOLs}
              />
            ) : (
              <KOLRankingTable
                kols={rankingKols}
                loading={isLoadingRanking}
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
                onLoadMore={handleLoadMore}
                onUpdate={refreshRankingKols}
              />
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
