"use client";

import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SectionCard from "@/components/SectionCard";
import KOLTrackerTable from "@/components/KOLTrackerTable";
import TopKols from "@/components/TopKols";
import { SwitchTab } from "@/components/ui/switch-tab";
import { KOL } from "@/lib/kolApi";
import { Star, TrendingUp } from "lucide-react";
import { useTrackedKOLs } from "@/hooks";

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
    <DashboardLayout title="KOL Tracker">
      <div className="flex-1 p-2 overflow-y-auto">
        <div className="space-y-2">
          {/* Unified KOL Table with Tab Switcher */}
          <SectionCard
            useSectionHeader
            padding="md"
            contentClassName="px-4 pb-4"
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
              <TopKols
                limit={20}
                showFilters={true}
                enableInfiniteScroll={true}
                maxHeight="calc(100vh - 220px)"
              />
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
