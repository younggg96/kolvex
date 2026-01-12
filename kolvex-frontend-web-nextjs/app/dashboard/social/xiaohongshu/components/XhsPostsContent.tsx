"use client";

import { PostSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { BookHeart } from "lucide-react";
import XhsPostFeedList from "@/components/xhs/XhsPostFeedList";
import { XhsPost } from "@/lib/xhsApi";

interface XhsPostsContentProps {
  posts: XhsPost[];
  isLoading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  hasFilters: boolean;
  onRetry: () => void;
}

export function XhsPostsContent({
  posts,
  isLoading,
  loadingMore,
  error,
  hasMore,
  hasFilters,
  onRetry,
}: XhsPostsContentProps) {
  if (isLoading) {
    return (
      <div className="relative z-10 flex flex-col gap-3">
        {[...Array(6)].map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative z-10 flex items-center justify-center h-full min-h-[400px]">
        <ErrorState title="Error" message={error} retry={onRetry} />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="relative z-10 flex items-center justify-center h-full min-h-[400px]">
        <EmptyState
          icon={BookHeart}
          title={
            hasFilters ? "No posts match your filters" : "No posts available"
          }
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
    <div className="relative z-10">
      <XhsPostFeedList posts={posts} />

      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
            <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading more posts...</span>
          </div>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="py-4 text-center text-xs text-gray-400 dark:text-white/30">
          All posts loaded
        </div>
      )}
    </div>
  );
}
