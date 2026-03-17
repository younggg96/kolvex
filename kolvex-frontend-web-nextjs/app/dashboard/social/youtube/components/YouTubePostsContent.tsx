"use client";

import React from "react";
import YouTubeVideoFeedList from "@/components/youtube/YouTubeVideoFeedList";
import { PostSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { KOLPost } from "@/lib/kolPostsApi";

interface YouTubePostsContentProps {
  posts: KOLPost[];
  isLoading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  hasFilters: boolean;
  onRetry: () => void;
}

export default function YouTubePostsContent({
  posts,
  isLoading,
  loadingMore,
  error,
  hasMore,
  hasFilters,
  onRetry,
}: YouTubePostsContentProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <ErrorState
          title="Failed to load videos"
          message={error}
          retry={onRetry}
        />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <EmptyState
          title={
            hasFilters
              ? "No videos match your filters"
              : "No YouTube videos yet"
          }
          description={
            hasFilters
              ? "Try adjusting your filters or clear them to see more videos."
              : "YouTube KOL videos will appear here once the scraper runs. Check back soon!"
          }
        />
      </div>
    );
  }

  return (
    <>
      <YouTubeVideoFeedList posts={posts} />

      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading more videos...</span>
          </div>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="py-4 text-center text-xs text-gray-400 dark:text-white/30">
          No more videos to load
        </div>
      )}
    </>
  );
}
