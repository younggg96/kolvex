"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { FilterSheet } from "@/components/common/FilterSheet";
import { MultiSelectOption } from "@/components/ui/multi-select";
import { POST_TAB_OPTIONS } from "@/lib/platformConfig";
import { useYoutubePosts, usePostFilters } from "./hooks";
import { YouTubePostsContent } from "./components";

const TabOptions = [...POST_TAB_OPTIONS];

export default function YouTubePageClient() {
  const [selectedTab, setSelectedTab] = useState<string>("all");

  const {
    posts,
    isLoading,
    loadingMore,
    error,
    hasMore,
    refreshPosts,
    loadMorePosts,
  } = useYoutubePosts({ selectedTab });

  const {
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
  } = usePostFilters({ posts });

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

  const tagOptions: MultiSelectOption[] = useMemo(() => {
    return availableTags.map((tag) => ({
      label: tag,
      value: tag,
    }));
  }, [availableTags]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPercentage =
      (target.scrollTop + target.clientHeight) / target.scrollHeight;

    if (scrollPercentage > 0.9 && hasMore && !loadingMore) {
      loadMorePosts();
    }
  };

  const hasFilters = selectedAuthors.length > 0 || selectedTags.length > 0;

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={refreshPosts}
        aria-label="Refresh"
      >
        <RotateCcw className="w-3.5 h-3.5" />
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
  );

  return (
    <DashboardLayout
      title="YouTube"
      showTitle={false}
      showHeader={true}
      headerExtra={
        <SwitchTab
          options={TabOptions}
          value={selectedTab}
          onValueChange={setSelectedTab}
          size="md"
          variant="underline"
          className="!w-fit"
        />
      }
      headerActions={headerActions}
    >
      <div className="relative flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none z-0" />

        <div
          className="relative flex-1 p-4 flex flex-col min-h-0 overflow-y-auto z-10"
          onScroll={handleScroll}
        >
          <YouTubePostsContent
            posts={filteredPosts}
            isLoading={isLoading}
            loadingMore={loadingMore}
            error={error}
            hasMore={hasMore}
            hasFilters={hasFilters}
            onRetry={refreshPosts}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
