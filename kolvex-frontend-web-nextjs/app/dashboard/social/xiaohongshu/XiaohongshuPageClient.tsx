"use client";

import React, { useMemo, useCallback, useState } from "react";
import Image from "next/image";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { MultiSelectOption } from "@/components/ui/multi-select";
import { FilterSheet } from "@/components/common/FilterSheet";
import { POST_TAB_OPTIONS } from "@/lib/platformConfig";
import { useXhsPosts, useXhsPostFilters } from "./hooks";
import { XhsPostsContent } from "./components";

const PostTabOption = [...POST_TAB_OPTIONS];

export default function XiaohongshuPageClient() {
  const [selectedTab, setSelectedTab] = useState<string>("all");

  const {
    posts,
    isLoading,
    loadingMore,
    error,
    hasMore,
    refreshPosts,
    loadMorePosts,
  } = useXhsPosts({ selectedTab });

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
  } = useXhsPostFilters({ posts });

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

  // Convert tags to MultiSelect options
  const tagOptions: MultiSelectOption[] = useMemo(() => {
    return availableTags.map((tag) => ({
      label: tag,
      value: tag,
    }));
  }, [availableTags]);

  const hasFilters =
    selectedAuthors.length > 0 ||
    selectedTags.length > 0 ||
    timeRange !== "all" ||
    !!dateRange?.from ||
    !!dateRange?.to;

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
  };

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const scrollPercentage =
        (target.scrollTop + target.clientHeight) / target.scrollHeight;

      if (scrollPercentage > 0.9 && hasMore && !loadingMore) {
        loadMorePosts();
      }
    },
    [hasMore, loadingMore, loadMorePosts]
  );

  const headerExtra = (
    <SwitchTab
      options={PostTabOption}
      value={selectedTab}
      onValueChange={handleTabChange}
      size="md"
      variant="underline"
      className="!w-fit"
    />
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={refreshPosts}
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
  );

  return (
    <DashboardLayout
      title="Xiaohongshu"
      showTitle={false}
      showHeader={true}
      headerExtra={headerExtra}
      headerActions={headerActions}
    >
      <div className="relative flex-1 flex flex-col min-h-0 bg-background-light dark:bg-background-dark overflow-hidden">
        {/* Fixed background that stays in place while content scrolls */}
        <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none z-0" />

        {/* Scrollable content */}
        <div
          className="relative flex-1 p-4 flex flex-col min-h-0 overflow-y-auto z-10"
          onScroll={handleScroll}
        >
          <XhsPostsContent
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
