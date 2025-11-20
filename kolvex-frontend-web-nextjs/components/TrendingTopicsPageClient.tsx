"use client";

import { useEffect, useState, useTransition, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import TrendingTopicsTable from "@/components/TrendingTopicsTable";
import SectionCard from "@/components/SectionCard";
import { TrendingTopic, Platform } from "@/lib/supabase/database.types";
import { fetchTrendingTopics } from "@/lib/trendingTopicApi";
import { TrendingUp, Loader2 } from "lucide-react";
import { SwitchTab } from "@/components/ui/switch-tab";
import { toast } from "sonner";

const platformOptions = [
  {
    value: "all",
    label: "All",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  {
    value: "TWITTER",
    label: "Twitter",
  },
  {
    value: "REDDIT",
    label: "Reddit",
  },
  {
    value: "REDNOTE",
    label: "Rednote",
  },
  {
    value: "YOUTUBE",
    label: "YouTube",
  },
];

const PAGE_SIZE = 50;

interface TrendingTopicsPageClientProps {
  initialTopics: TrendingTopic[];
}

export default function TrendingTopicsPageClient({
  initialTopics,
}: TrendingTopicsPageClientProps) {
  const [topics, setTopics] = useState<TrendingTopic[]>(initialTopics);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(initialTopics.length);

  const observerTarget = useRef<HTMLDivElement>(null);

  // Update topics when initialTopics changes
  useEffect(() => {
    setTopics(initialTopics);
    setOffset(initialTopics.length);
    setHasMore(initialTopics.length >= PAGE_SIZE);
  }, [initialTopics]);

  const loadTopics = async (platformValue?: string, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const currentOffset = append ? offset : 0;
      const data = await fetchTrendingTopics({
        limit: PAGE_SIZE,
        offset: currentOffset,
        platform:
          platformValue === "all" ? undefined : (platformValue as Platform),
        sortBy: "trending_score",
        sortDirection: "desc",
      });

      const newTopics = data.topics || [];

      if (append) {
        setTopics((prev) => [...prev, ...newTopics]);
        setOffset((prev) => prev + newTopics.length);
      } else {
        setTopics(newTopics);
        setOffset(newTopics.length);
      }

      // Check if there are more items to load
      setHasMore(newTopics.length >= PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching trending topics:", error);
      toast.error("Failed to load trending topics");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setOffset(0);
    setHasMore(true);
    startTransition(() => {
      loadTopics(value, false);
    });
  };

  // Load more when scrolling to bottom
  const loadMore = useCallback(() => {
    if (!loadingMore && !loading && hasMore) {
      loadTopics(activeTab, true);
    }
  }, [loadingMore, loading, hasMore, activeTab, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMore, hasMore, loadingMore, loading]);

  return (
    <DashboardLayout title="Trending Topics">
      <div className="flex-1 p-2 overflow-y-auto">
        <div className="space-y-2">
          <SectionCard
            useSectionHeader={false}
            showLiveIndicator={false}
            headerBorder
            padding="md"
            scrollable
            maxHeight="calc(100vh - 100px)"
            contentClassName="space-y-0 px-4 pb-4 mt-2"
            headerRightExtra={
              <SwitchTab
                options={platformOptions}
                value={activeTab}
                onValueChange={handleTabChange}
                size="md"
                variant="pills"
                className="w-auto"
                disabled={isPending || loading}
              />
            }
          >
            <div className="min-h-[400px]">
              <TrendingTopicsTable
                topics={topics}
                loading={loading}
                onUpdate={() => loadTopics(activeTab, false)}
              />

              {/* Loading More Indicator */}
              {loadingMore && (
                <div className="flex justify-center items-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading more topics...
                  </span>
                </div>
              )}

              {/* No More Data Indicator */}
              {!loading && !loadingMore && !hasMore && topics.length > 0 && (
                <div className="flex justify-center items-center py-6">
                  <span className="text-sm text-muted-foreground">
                    No more topics to load
                  </span>
                </div>
              )}

              {/* Intersection Observer Target */}
              <div ref={observerTarget} className="h-4" />
            </div>
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
