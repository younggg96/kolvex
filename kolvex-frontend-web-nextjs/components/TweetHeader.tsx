"use client";

import Image from "next/image";
import type { Platform } from "@/lib/supabase/database.types";
import KOLHoverCard from "./KOLHoverCard";

interface TweetHeaderProps {
  screenName: string;
  createdAt: string;
  profileImageUrl?: string;
  onFormatDate: (dateString: string) => string;
  initialTracked?: boolean;
  onTrackChange?: (tracked: boolean) => void;
  kolId?: string;
  platform?: Platform;
}

export default function TweetHeader({
  screenName,
  createdAt,
  profileImageUrl,
  onFormatDate,
  initialTracked = false,
  onTrackChange,
  kolId,
  platform = "TWITTER",
}: TweetHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <KOLHoverCard
        kolId={kolId}
        screenName={screenName}
        profileImageUrl={profileImageUrl}
        platform={platform}
        initialTracked={initialTracked}
        onTrackChange={onTrackChange}
      >
        {profileImageUrl ? (
          <Image
            src={profileImageUrl}
            alt={screenName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-white text-xs font-bold flex-shrink-0 cursor-pointer">
            {screenName.substring(0, 2).toUpperCase()}
          </div>
        )}
      </KOLHoverCard>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center">
          <KOLHoverCard
            kolId={kolId}
            screenName={screenName}
            profileImageUrl={profileImageUrl}
            platform={platform}
            initialTracked={initialTracked}
            onTrackChange={onTrackChange}
          >
            <span className="hover:underline cursor-pointer">{screenName}</span>
          </KOLHoverCard>
          <span className="text-gray-500 dark:text-white/50 font-normal text-xs ml-1">
            @{screenName.toLowerCase()} · {onFormatDate(createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
