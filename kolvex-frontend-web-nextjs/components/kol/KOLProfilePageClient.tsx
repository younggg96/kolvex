"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import SectionCard from "@/components/layout/SectionCard";
import PostFeedList from "@/components/tweet/PostFeedList";
import { KOLProfileDetail } from "@/app/api/kol/route";
import { KOLTweet } from "@/lib/kolTweetsApi";
import { trackKOL, untrackKOL, isKOLTracked } from "@/lib/trackedKolApi";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import KOLAnalysisPanel from "./KOLAnalysisPanel";
import KOLProfileHeader from "./KOLProfileHeader";

interface KOLProfilePageClientProps {
  username: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  return `${Math.floor(diffInSeconds / 86400)}d`;
}

function formatTweetText(text: string) {
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

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full pb-8">
      <div className="animate-pulse">
        {/* Banner Skeleton */}
        <Skeleton className="w-full h-32 sm:h-48 rounded-none" />
        <div className="px-4 pb-4">
          {/* Avatar Row */}
          <div className="relative flex justify-between items-end -mt-10 sm:-mt-14 mb-3">
            <div className="h-20 w-20 sm:h-28 sm:w-28 shrink-0 relative">
              <Skeleton className="h-full w-full !rounded-full border-4 border-background" />
            </div>
            <div className="flex gap-2 mb-1">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
          {/* Name & Handle */}
          <div className="space-y-2 mb-4">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          {/* Bio */}
          <div className="space-y-1 mb-4 max-w-lg">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          {/* Metadata */}
          <div className="flex gap-4 mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          {/* Stats */}
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {/* Tabs Skeleton */}
        <div className="px-4 mt-4 pt-2">
          <Skeleton className="h-9 w-20 rounded-none" />
        </div>
      </div>
      {/* Feed Skeleton */}
      <div className="p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-4">
            {/* Post Header Skeleton */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>

            {/* Post Content Skeleton */}
            <div className="pl-[52px] space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-2/3" />
              </div>

              {/* Media Skeleton (simulating occasional media) */}
              {i % 2 === 0 && (
                <Skeleton className="w-full h-48 sm:h-64 rounded-xl mt-3" />
              )}

              {/* Action Buttons Skeleton */}
              <div className="flex gap-6 pt-1">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KOLProfilePageClient({
  username,
}: KOLProfilePageClientProps) {
  const [profileData, setProfileData] = useState<KOLProfileDetail | null>(null);
  const [tweets, setTweets] = useState<KOLTweet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");

  const PAGE_SIZE = 20;

  // Fetch profile and initial tweets
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch profile with tweets
      const response = await fetch(
        `/api/kol?kolId=${username}&include_tweets=true&tweet_limit=${PAGE_SIZE}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("KOL not found");
        }
        throw new Error("Failed to fetch KOL profile");
      }

      const data: KOLProfileDetail = await response.json();
      setProfileData(data);
      setTweets(data.recent_tweets || []);
      setHasMore((data.recent_tweets?.length || 0) >= PAGE_SIZE);

      // Check tracking status
      const tracked = await isKOLTracked(username, "TWITTER");
      setIsTracking(tracked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  // Load more tweets
  const loadMoreTweets = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await fetch(
        `/api/tweets?username=${username}&page=${nextPage}&page_size=${PAGE_SIZE}`
      );

      if (!response.ok) throw new Error("Failed to load more tweets");

      const data = await response.json();
      const newTweets = data.tweets || [];

      setTweets((prev) => [...prev, ...newTweets]);
      setPage(nextPage);
      setHasMore(newTweets.length >= PAGE_SIZE);
    } catch (err) {
      console.error("Failed to load more tweets:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Handle scroll for infinite loading
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPercentage =
      (target.scrollTop + target.clientHeight) / target.scrollHeight;

    if (scrollPercentage > 0.9 && hasMore && !isLoadingMore) {
      loadMoreTweets();
    }
  };

  // Handle track toggle
  const handleTrackToggle = async () => {
    setIsTrackLoading(true);
    try {
      if (isTracking) {
        await untrackKOL(username, "TWITTER");
        setIsTracking(false);
        toast.success(`Untracked @${username}`);
      } else {
        await trackKOL({ kol_id: username, platform: "TWITTER", notify: true });
        setIsTracking(true);
        toast.success(`Now tracking @${username}`);
      }
    } catch (error: any) {
      console.error("Error toggling track status:", error);
      toast.error(error.message || "Failed to update tracking status");
    } finally {
      setIsTrackLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const profile = profileData?.profile;

  // Back button component for DashboardLayout header
  const backButton = (
    <Button
      variant="ghost"
      size="icon"
      className="h-3.5 w-3.5 rounded-full mr-2"
      onClick={() => window.history.back()}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
    </Button>
  );

  return (
    <DashboardLayout
      title={profile?.display_name || username}
      headerLeftAction={backButton}
    >
      <div className="h-full flex gap-2 p-2">
        {/* Left Column - Profile & Tweets */}
        <SectionCard
          className="flex-1 flex flex-col overflow-hidden lg:max-w-[calc(100%-320px)]"
          contentClassName="p-0"
          scrollable
          onScroll={handleScroll}
          useSectionHeader={false}
        >
          {isLoading ? (
            <ProfileSkeleton />
          ) : error ? (
            <div className="p-8 flex items-center justify-center h-full">
              <ErrorState
                title="Failed to load profile"
                message={error || "An error occurred"}
                retry={fetchProfile}
              />
            </div>
          ) : profile ? (
            <div className="mx-auto w-full pb-8">
              {/* Profile Header */}
              <KOLProfileHeader
                profile={profile}
                username={username}
                isTracking={isTracking}
                isTrackLoading={isTrackLoading}
                onTrackToggle={handleTrackToggle}
              />

              {/* Tweets Feed */}
              <div className="min-h-[200px] p-4">
                {tweets.length === 0 ? (
                  <div className="mt-8">
                    <EmptyState
                      title="No posts yet"
                      description={`@${username} hasn't posted anything yet.`}
                    />
                  </div>
                ) : (
                  <>
                    <PostFeedList
                      posts={tweets}
                      formatDate={formatDate}
                      formatText={formatTweetText}
                    />

                    {/* Loading More */}
                    {isLoadingMore && (
                      <div className="py-6 text-center">
                        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Loading more posts...</span>
                        </div>
                      </div>
                    )}

                    {/* End of Feed */}
                    {!hasMore && tweets.length > 0 && (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        No more posts to load
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </SectionCard>

        {/* Right Column - Analysis Panel (Desktop Only) */}
        <div className="hidden lg:flex w-[800px] shrink-0 h-full">
          <SectionCard
            className="flex-1 flex flex-col overflow-hidden"
            contentClassName="p-0 flex-1 min-h-0"
            useSectionHeader={false}
          >
            <KOLAnalysisPanel
              username={username}
              displayName={profile?.display_name}
              avatarUrl={profile?.avatar_url}
              tweets={tweets}
              isLoading={isLoading}
            />
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
