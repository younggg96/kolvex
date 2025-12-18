"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BadgeCheck,
  MapPin,
  Link as LinkIcon,
  CalendarDays,
  Loader2,
  Star,
} from "lucide-react";
import { KOLProfile } from "@/app/api/kol/route";
import { proxyImageUrl } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface KOLProfileHeaderProps {
  profile: KOLProfile;
  username: string;
  isTracking: boolean;
  isTrackLoading: boolean;
  onTrackToggle: () => void;
}

// ============================================================
// Helper Functions
// ============================================================

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// ============================================================
// Main Component
// ============================================================

export default function KOLProfileHeader({
  profile,
  username,
  isTracking,
  isTrackLoading,
  onTrackToggle,
}: KOLProfileHeaderProps) {
  return (
    <>
      {/* Banner */}
      <div className="relative w-full h-32 sm:h-48 bg-muted overflow-hidden">
        {profile.banner_url ? (
          <Image
            src={profile.banner_url}
            alt="Banner"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 896px"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20" />
        )}
      </div>

      <div className="px-4 pb-4">
        {/* Avatar & Edit/Track Button Row */}
        <div className="relative flex justify-between items-end -mt-10 sm:-mt-14 mb-3">
          <Avatar className="h-20 w-20 sm:h-28 sm:w-28 border-4 border-background ring-1 ring-black/5 dark:ring-white/10">
            <AvatarImage src={proxyImageUrl(profile.avatar_url)} />
            <AvatarFallback className="text-2xl font-bold">
              {(profile.display_name || username).substring(0, 2).toUpperCase()}
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
                <span className="hidden sm:inline text-xs">View on X</span>
              </a>
            </Button>

            {/* Track Button */}
            <Button
              variant={isTracking ? "default" : "outline"}
              size="sm"
              className={`rounded-full h-8 px-4 min-w-[90px] ${
                isTracking
                  ? "bg-yellow-500 text-white hover:bg-yellow-600"
                  : "border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
              }`}
              onClick={onTrackToggle}
              disabled={isTrackLoading}
            >
              {isTrackLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isTracking ? (
                <>
                  <Star className="w-3.5 h-3.5 mr-1 fill-yellow-500" />
                  Tracking
                </>
              ) : (
                <>
                  <Star className="w-3.5 h-3.5 mr-1" />
                  Track
                </>
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
          <div className="text-muted-foreground">@{profile.username}</div>
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
    </>
  );
}

