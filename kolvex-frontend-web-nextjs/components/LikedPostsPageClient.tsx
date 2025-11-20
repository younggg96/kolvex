"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "./DashboardLayout";
import SectionCard from "./SectionCard";
import { Heart } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { CardSkeleton } from "./LoadingSkeleton";
import { EmptyState } from "./EmptyState";
import { socialPostToUnifiedPost, UnifiedPost } from "@/lib/postTypes";
import { SwitchTab } from "./ui/switch-tab";
import PostFeedList from "./PostFeedList";
import { PLATFORM_TAB_OPTIONS } from "@/lib/platformConfig";

// Convert platform config to SwitchTab format with React components
const PlatformTabOption = PLATFORM_TAB_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  icon: "iconPath" in option && option.iconPath ? (
    <Image
      src={option.iconPath}
      alt={option.label}
      width={16}
      height={16}
      className="w-4 h-4"
    />
  ) : (
    ""
  ),
}));

export default function LikedPostsPageClient() {
  const [likedPosts, setLikedPosts] = useState<UnifiedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  // Fetch liked posts
  const fetchLikedPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/user/posts?type=liked");
      if (!response.ok) throw new Error("Failed to fetch liked posts");
      const data = await response.json();

      const posts = (data.posts || []).map((post: any) =>
        socialPostToUnifiedPost(post)
      );
      setLikedPosts(posts);
    } catch (error) {
      console.error("Error fetching liked posts:", error);
      toast.error("Failed to load liked posts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLikedPosts();
  }, [fetchLikedPosts]);

  // Filter posts by platform
  const filteredPosts =
    selectedPlatform === "all"
      ? likedPosts
      : likedPosts.filter((post) => post.platform === selectedPlatform);

  return (
    <DashboardLayout title="Liked Posts">
      <div className="flex-1 p-2 overflow-y-auto">
        <SectionCard
          useSectionHeader={false}
          scrollable
          contentClassName="space-y-0 px-4 pb-4"
          className="h-full flex flex-col"
        >
          {/* Platform Filter */}
          <div className="border-b border-border-light dark:border-border-dark">
            <SwitchTab
              options={PlatformTabOption}
              value={selectedPlatform}
              onValueChange={setSelectedPlatform}
              size="md"
              variant="underline"
              className="w-full"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2 pt-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                title={
                  likedPosts.length === 0
                    ? "No liked posts yet"
                    : "No posts found for this platform"
                }
                description={
                  likedPosts.length === 0
                    ? "Posts you like will appear here"
                    : "Try selecting a different platform"
                }
              />
            </div>
          ) : (
            <div className="pt-3">
              <PostFeedList posts={filteredPosts} />
            </div>
          )}
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}
