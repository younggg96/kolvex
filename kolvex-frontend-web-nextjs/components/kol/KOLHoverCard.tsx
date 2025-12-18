"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Users,
  MapPin,
  Link as LinkIcon,
  BadgeCheck,
  UserPlus,
  Loader2,
  Check,
  Plus,
  ExternalLink,
} from "lucide-react";
import { KOLProfileDetail } from "@/app/api/kol/route";
import { trackKOL, untrackKOL, isKOLTracked } from "@/lib/trackedKolApi";
import type { Platform } from "@/lib/supabase/database.types";
import { toast } from "sonner";
import { proxyImageUrl } from "@/lib/utils";

// Global cache for tracking status
const kolTrackingCache = new Map<string, boolean>();

// Global cache for KOL profile data
const kolProfileCache = new Map<string, KOLProfileDetail>();

// Format follower count
function formatFollowers(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

interface KOLHoverCardProps {
  children: React.ReactNode;
  kolId?: string; // username
  screenName: string;
  profileImageUrl?: string;
  platform?: Platform;
  initialTracked?: boolean;
  onTrackChange?: (tracked: boolean) => void;
}

const KOLHoverCardSkeleton = () => (
  <div className="animate-pulse">
    {/* Banner Skeleton */}
    <Skeleton className="w-full h-20 rounded-none" />
    <div className="px-4 pb-4 -mt-6">
      {/* Avatar Skeleton */}
      <div className="flex items-end gap-3 mb-3">
        <div className="h-14 w-14 shrink-0 relative z-10">
          <Skeleton className="h-full w-full !rounded-full" />
        </div>
        <div className="flex-1 pb-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {/* Bio Skeleton */}
      <div className="space-y-1 mb-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      {/* Stats Skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  </div>
);

export default function KOLHoverCard({
  children,
  kolId,
  screenName,
  profileImageUrl,
  platform = "TWITTER",
  initialTracked = false,
  onTrackChange,
}: KOLHoverCardProps) {
  const [profileData, setProfileData] = useState<KOLProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isTracking, setIsTracking] = useState(initialTracked);
  const [isTrackLoading, setIsTrackLoading] = useState(false);

  // Update state when initialTracked prop changes
  useEffect(() => {
    setIsTracking(initialTracked);
  }, [initialTracked]);

  const handleTrackToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!kolId) return;

    const cacheKey = `${kolId}-${platform}`;
    setIsTrackLoading(true);
    try {
      if (isTracking) {
        await untrackKOL(kolId, platform);
        setIsTracking(false);
        kolTrackingCache.set(cacheKey, false);
        onTrackChange?.(false);
        toast.success(`Untracked @${screenName}`);
      } else {
        await trackKOL({ kol_id: kolId, platform, notify: true });
        setIsTracking(true);
        kolTrackingCache.set(cacheKey, true);
        onTrackChange?.(true);
        toast.success(`Now tracking @${screenName}`);
      }
    } catch (error: any) {
      console.error("Error toggling track status:", error);
      toast.error(error.message || "Failed to update tracking status");
    } finally {
      setIsTrackLoading(false);
    }
  };

  // Fetch profile data and tracking status when hover card opens
  const handleOpenChange = useCallback(
    async (open: boolean) => {
      if (!open || !kolId) return;

      // Always check tracking status when opening (but use cache if available)
      const cacheKey = `${kolId}-${platform}`;
      if (kolTrackingCache.has(cacheKey)) {
        setIsTracking(kolTrackingCache.get(cacheKey)!);
      } else {
        // Check tracking status from API
        try {
          const tracked = await isKOLTracked(kolId, platform);
          setIsTracking(tracked);
          kolTrackingCache.set(cacheKey, tracked);
        } catch (error) {
          console.error("Failed to check tracking status", error);
        }
      }

      // Skip profile fetch if already fetched
      if (hasFetched) return;

      // Check profile cache first
      const cachedData = kolProfileCache.get(kolId);
      if (cachedData) {
        setProfileData(cachedData);
        setHasFetched(true);
        return;
      }

      // Fetch profile from API
      setLoading(true);
      try {
        const response = await fetch(`/api/kol?kolId=${kolId}`);
        if (response.ok) {
          const data = await response.json();
          if (data) {
            // Store in cache
            kolProfileCache.set(kolId, data);
            setProfileData(data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch KOL profile", error);
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    },
    [kolId, platform, hasFetched]
  );

  // If no KOL ID, just render children
  if (!kolId) return <>{children}</>;

  const profile = profileData?.profile;

  return (
    <HoverCard onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <Link
          href={`/dashboard/kol/${kolId}`}
          className="cursor-pointer inline-block"
        >
          {children}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 !p-0 overflow-hidden">
        {loading ? (
          <KOLHoverCardSkeleton />
        ) : profile ? (
          <div className="space-y-3">
            {/* Banner */}
            {profile.banner_url ? (
              <div className="relative w-full h-20">
                <Image
                  src={profile.banner_url}
                  alt="Banner"
                  fill
                  sizes="320px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30" />
              </div>
            ) : (
              <div className="w-full h-20 bg-gradient-to-r from-primary/20 to-primary/10" />
            )}

            {/* Content with padding */}
            <div className="px-4 pb-4 -mt-6 space-y-3">
              {/* Avatar overlapping banner */}
              <div className="flex items-end gap-3">
                <Avatar className="h-14 w-14 border-4 border-white dark:border-card-dark relative z-10">
                  <AvatarImage src={proxyImageUrl(profile.avatar_url || profileImageUrl)} />
                  <AvatarFallback>
                    {(profile.display_name || screenName)
                      .substring(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-1">
                    <h4 className="text-sm font-semibold truncate">
                      {profile.display_name || screenName}
                    </h4>
                    {profile.is_verified && (
                      <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    @{profile.username}
                  </p>
                </div>
                {/* Track Button */}
                <Button
                  variant={isTracking ? "default" : "outline"}
                  size="sm"
                  onClick={handleTrackToggle}
                  disabled={isTrackLoading}
                  className={`flex-shrink-0 ${
                    isTracking
                      ? "bg-primary hover:bg-primary/90 text-white"
                      : "border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                  }`}
                >
                  {isTrackLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isTracking ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      <span>Tracking</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      <span>Track</span>
                    </>
                  )}
                </Button>
              </div>
              {profile.category && (
                <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
                  {profile.category}
                </span>
              )}

              {/* Bio */}
              {profile.bio && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {profile.bio}
                </p>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">
                    {formatFollowers(profile.followers_count)}
                  </span>
                  <span className="text-muted-foreground">Followers</span>
                </div>
                <div className="flex items-center gap-1">
                  <UserPlus className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">
                    {formatFollowers(profile.following_count)}
                  </span>
                  <span className="text-muted-foreground">Following</span>
                </div>
              </div>

              {/* Location and website */}
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                {profile.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.website && (
                  <div className="flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" />
                    <a
                      href={
                        profile.website.startsWith("http")
                          ? profile.website
                          : `https://${profile.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {profile.website}
                    </a>
                  </div>
                )}
                {profile.join_date && (
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    <span>Joined {profile.join_date}</span>
                  </div>
                )}
              </div>

              {/* View Profile Button */}
              <div className="pt-3 mt-1">
                <Button
                  variant="secondary"
                  className="w-full gap-2 h-8 text-xs font-medium"
                  asChild
                >
                  <Link href={`/dashboard/kol/${kolId}`}>
                    <span>View Profile</span>
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <KOLHoverCardSkeleton />
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
