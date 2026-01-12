"use client";

import React from "react";
import PostFeedList from "@/components/post/PostFeedList";
import { PostSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { KOLPost } from "@/lib/kolPostsApi";

interface TwitterPostsContentProps {
  posts: KOLPost[];
  isLoading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  hasFilters: boolean;
  onRetry: () => void;
}

// Format relative time
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h`;
  } else {
    return `${Math.floor(diffInSeconds / 86400)}d`;
  }
}

// Format tweet text with highlighted hashtags and symbols
function formatTweetText(text: string): React.ReactNode {
  return text.split(/(\s+)/).map((word, index) => {
    if (word.startsWith("#") || word.startsWith("$")) {
      return (
        <span key={index} className="text-sky-400">
          {word}
        </span>
      );
    }
    return word;
  });
}

export default function TwitterPostsContent({
  posts,
  isLoading,
  loadingMore,
  error,
  hasMore,
  hasFilters,
  onRetry,
}: TwitterPostsContentProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(6)].map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <ErrorState title="Failed to load posts" message={error} retry={onRetry} />
      </div>
    );
  }

  // Empty state
  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <EmptyState
          title={hasFilters ? "No posts match your filters" : "No posts available"}
          description={
            hasFilters
              ? "Try adjusting your filters or clear them to see more posts."
              : "There are no posts to display at the moment."
          }
        />
      </div>
    );
  }

  return (
    <>
      <PostFeedList
        posts={posts}
        formatDate={formatDate}
        formatText={formatTweetText}
      />

      {/* Loading More Indicator */}
      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading more posts...</span>
          </div>
        </div>
      )}

      {/* No More Data Indicator */}
      {!hasMore && posts.length > 0 && (
        <div className="py-4 text-center text-xs text-gray-400 dark:text-white/30">
          No more posts to load
        </div>
      )}
    </>
  );
}
