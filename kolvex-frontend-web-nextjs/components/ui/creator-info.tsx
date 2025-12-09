"use client";

import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { PlatformBadge } from "./platform-badge";
import { CheckCircle } from "lucide-react";
import type { Platform } from "@/lib/supabase/database.types";

interface CreatorInfoProps {
  avatarUrl?: string | null;
  name: string;
  username?: string | null;
  platform: string;
  verified?: boolean;
  showPlatformBadge?: boolean;
  category?: string | null;
}

export function CreatorInfo({
  avatarUrl,
  name,
  username,
  platform,
  verified = false,
  showPlatformBadge = true,
  category,
}: CreatorInfoProps) {
  return (
    <div className="flex items-center justify-between w-full gap-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar className="w-9 h-9 flex-shrink-0 ring-1 ring-gray-200 dark:ring-white/10">
          <AvatarImage src={avatarUrl || ""} alt={name} />
          <AvatarFallback className="text-xs font-bold bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-white/60">
            {name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-row gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {name}
              </h3>
              {verified && (
                <CheckCircle className="w-3 h-3 text-blue-500 flex-shrink-0" />
              )}
            </div>
            {username && (
              <p className="text-[10px] text-gray-500 dark:text-white/50 truncate">
                @{username}
              </p>
            )}
            {category && (
              <span className="inline-block text-[10px] text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded mt-0.5">
                {category}
              </span>
            )}
          </div>
        </div>
      </div>
      {showPlatformBadge && (
        <PlatformBadge
          platform={platform.toUpperCase() as Platform}
          size="sm"
          className="!h-fit"
        />
      )}
    </div>
  );
}
