"use client";

import React from "react";
import type { Platform } from "@/lib/supabase/database.types";
import KOLHoverCard from "@/components/kol/KOLHoverCard";
import { proxyImageUrl } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PlatformBadge } from "@/components/ui/platform-badge";

interface YouTubeVideoHeaderProps {
  channelName: string;
  createdAt: string;
  avatarUrl?: string;
  onFormatDate: (dateString: string) => string;
  kolId?: string;
  rightContent?: React.ReactNode;
}

export default function YouTubeVideoHeader({
  channelName,
  createdAt,
  avatarUrl,
  onFormatDate,
  kolId,
  rightContent,
}: YouTubeVideoHeaderProps) {
  const platform: Platform = "youtube";

  return (
    <div className="flex items-center gap-3 mb-3">
      <KOLHoverCard
        kolId={kolId}
        screenName={channelName}
        profileImageUrl={avatarUrl}
        platform={platform}
      >
        <Avatar className="w-8 h-8 flex-shrink-0 cursor-pointer">
          <AvatarImage
            src={proxyImageUrl(avatarUrl || "")}
            alt={channelName}
            className="object-cover"
          />
          <AvatarFallback className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
            {channelName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </KOLHoverCard>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-gray-900 dark:text-white flex sm:items-center sm:flex-row flex-col gap-1">
          <KOLHoverCard
            kolId={kolId}
            screenName={channelName}
            profileImageUrl={avatarUrl}
            platform={platform}
          >
            <span className="hover:underline cursor-pointer truncate">
              {channelName}
            </span>
          </KOLHoverCard>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PlatformBadge platform={platform} size="sm" />
            <span>&middot;</span>
            <span>{onFormatDate(createdAt)}</span>
          </div>
        </div>
      </div>

      {rightContent && <div className="flex-shrink-0">{rightContent}</div>}
    </div>
  );
}
