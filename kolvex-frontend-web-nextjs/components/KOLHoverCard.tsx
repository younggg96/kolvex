"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays,
  Users,
  MapPin,
  Link as LinkIcon,
  BadgeCheck,
  UserPlus,
  Heart,
  Repeat,
} from "lucide-react";
import { KOLProfileDetail } from "@/app/api/kol/route";

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
}

export default function KOLHoverCard({
  children,
  kolId,
  screenName,
  profileImageUrl,
}: KOLHoverCardProps) {
  const [profileData, setProfileData] = useState<KOLProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch profile data only when hover card opens
  const handleOpenChange = useCallback(
    async (open: boolean) => {
      if (!open || !kolId || hasFetched) return;

      // Check cache first
      const cachedData = kolProfileCache.get(kolId);
      if (cachedData) {
        setProfileData(cachedData);
        setHasFetched(true);
        return;
      }

      // Fetch from API
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
    [kolId, hasFetched]
  );

  // If no KOL ID, just render children
  if (!kolId) return <>{children}</>;

  const profile = profileData?.profile;

  return (
    <HoverCard onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer inline-block">{children}</div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 !p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
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
                  <AvatarImage src={profile.avatar_url || profileImageUrl} />
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
                {profile.category && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
                    {profile.category}
                  </span>
                )}
              </div>

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

              {/* Tweet stats */}
              {profileData && (
                <div className="flex items-center gap-4 text-xs border-t border-border pt-2 dark:border-border-dark">
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">
                      {formatFollowers(profileData.total_likes)}
                    </span>
                    <span className="text-muted-foreground">Likes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Repeat className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">
                      {formatFollowers(profileData.total_retweets)}
                    </span>
                    <span className="text-muted-foreground">RTs</span>
                  </div>
                </div>
              )}

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
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profileImageUrl} />
              <AvatarFallback>
                {screenName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="text-sm font-semibold">{screenName}</h4>
              <p className="text-xs text-muted-foreground">@{kolId}</p>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
