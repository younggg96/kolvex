"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import SectionCard from "@/components/SectionCard";
import PostFeedList from "@/components/PostFeedList";
import { KOLProfileDetail } from "@/app/api/kol/route";
import { KOLTweet } from "@/lib/kolTweetsApi";
import { trackKOL, untrackKOL, isKOLTracked } from "@/lib/trackedKolApi";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Link as LinkIcon,
  CalendarDays,
  Loader2,
  Check,
  Plus,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { SwitchTab } from "@/components/ui/switch-tab";

interface KOLProfilePageClientProps {
  username: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top Navigation */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-2 bg-background/80 backdrop-blur-md">
        <Link href="/dashboard/kol">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex flex-col">
          <h1 className="text-sm font-bold leading-tight">
            {profile?.display_name || username}
          </h1>
          {profile && (
            <span className="text-xs text-muted-foreground">
              {formatNumber(profile.posts_count)} posts
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-4 max-w-4xl mx-auto w-full">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={4} />
        </div>
      ) : error ? (
        <div className="p-8">
          <ErrorState
            title="Failed to load profile"
            message={error}
            retry={fetchProfile}
          />
        </div>
      ) : profile ? (
        <div className="flex-1 overflow-auto" onScroll={handleScroll}>
          <div className="max-w-4xl mx-auto w-full pb-8">
            {/* Profile Header Card */}
            <div className="bg-card">
              {/* Banner */}
              <div className="relative w-full h-32 sm:h-48 bg-muted">
                {profile.banner_url ? (
                  <Image
                    src={profile.banner_url}
                    alt="Banner"
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20" />
                )}
              </div>

              <div className="px-4 pb-4">
                {/* Avatar & Edit/Track Button Row */}
                <div className="relative flex justify-between items-end -mt-10 sm:-mt-14 mb-3">
                  <Avatar className="h-20 w-20 sm:h-28 sm:w-28 border-4 border-background ring-1 ring-black/5 dark:ring-white/10">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl font-bold">
                      {(profile.display_name || username)
                        .substring(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex gap-2 mb-1">
                    {/* View on X Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full h-8 px-3 gap-1.5"
                      asChild
                    >
                      <a
                        href={`https://twitter.com/${profile.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Image
                          src="/logo/x.svg"
                          alt="X"
                          width={12}
                          height={12}
                          className="opacity-70 dark:invert"
                        />
                        <span className="hidden sm:inline text-xs">
                          View on X
                        </span>
                      </a>
                    </Button>

                    {/* Track Button */}
                    <Button
                      variant={isTracking ? "default" : "outline"}
                      size="sm"
                      className={`rounded-full h-8 px-4 min-w-[90px] ${
                        isTracking
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-primary text-primary hover:bg-primary/5"
                      }`}
                      onClick={handleTrackToggle}
                      disabled={isTrackLoading}
                    >
                      {isTrackLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isTracking ? (
                        "Tracking"
                      ) : (
                        "Track"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Name & Handle */}
                <div className="mb-3">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xl font-bold text-foreground">
                      {profile.display_name || username}
                    </h2>
                    {profile.is_verified && (
                      <BadgeCheck className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    @{profile.username}
                  </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                )}

                {/* Metadata Row */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mb-3">
                  {profile.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center gap-1">
                      <LinkIcon className="h-3.5 w-3.5" />
                      <a
                        href={
                          profile.website.startsWith("http")
                            ? profile.website
                            : `https://${profile.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate max-w-[200px]"
                      >
                        {profile.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                  {profile.join_date && (
                    <div className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>Joined {profile.join_date}</span>
                    </div>
                  )}
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex gap-1 hover:underline cursor-pointer">
                    <span className="font-bold text-foreground">
                      {formatNumber(profile.following_count)}
                    </span>
                    <span className="text-muted-foreground">Following</span>
                  </div>
                  <div className="flex gap-1 hover:underline cursor-pointer">
                    <span className="font-bold text-foreground">
                      {formatNumber(profile.followers_count)}
                    </span>
                    <span className="text-muted-foreground">Followers</span>
                  </div>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="px-4">
                <SwitchTab
                  options={[
                    {
                      label: "Posts",
                      value: "posts",
                      icon: <MessageSquare className="w-3.5 h-3.5" />,
                    },
                    // Add more tabs here in future (e.g., Media, Replies)
                  ]}
                  value={activeTab}
                  onValueChange={setActiveTab}
                  variant="underline"
                  className="w-full justify-start"
                />
              </div>
            </div>

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
        </div>
      ) : null}
    </div>
  );
}
