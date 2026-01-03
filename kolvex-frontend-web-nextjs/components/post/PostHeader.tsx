"use client";

import type { Platform } from "@/lib/supabase/database.types";
import KOLHoverCard from "@/components/kol/KOLHoverCard";
import { proxyImageUrl } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface PostHeaderProps {
  screenName: string;
  createdAt: string;
  profileImageUrl?: string;
  onFormatDate: (dateString: string) => string;
  initialTracked?: boolean;
  onTrackChange?: (tracked: boolean) => void;
  kolId?: string;
  platform?: Platform;
  rightContent?: React.ReactNode;
}

export default function PostHeader({
  screenName,
  createdAt,
  profileImageUrl,
  onFormatDate,
  initialTracked = false,
  onTrackChange,
  kolId,
  platform = "twitter",
  rightContent,
}: PostHeaderProps) {
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
        <Avatar className="w-8 h-8 flex-shrink-0 cursor-pointer">
          <AvatarImage
            src={proxyImageUrl(profileImageUrl || "")}
            alt={screenName}
            className="object-cover"
          />
          <AvatarFallback className="bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-white text-xs font-bold">
            {screenName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </KOLHoverCard>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-gray-900 dark:text-white flex sm:items-center sm:flex-row flex-col gap-1">
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
          <span className="text-gray-500 dark:text-white/50 font-normal text-xs sm:ml-1">
            @{screenName.toLowerCase()} · {onFormatDate(createdAt)}
          </span>
        </div>
      </div>
      {rightContent}
    </div>
  );
}
