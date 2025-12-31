"use client";

import KOLHoverCard from "@/components/kol/KOLHoverCard";
import { proxyImageUrl } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Image from "next/image";

interface XhsPostHeaderProps {
  authorName: string;
  authorId: string;
  createdAt: string;
  authorAvatar?: string;
  onFormatDate: (dateString: string) => string;
  initialTracked?: boolean;
  onTrackChange?: (tracked: boolean) => void;
}

export default function XhsPostHeader({
  authorName,
  authorId,
  createdAt,
  authorAvatar,
  onFormatDate,
  initialTracked = false,
  onTrackChange,
}: XhsPostHeaderProps) {
  const displayName = authorName || authorId || "Xiaohongshu User";

  return (
    <div className="flex items-center gap-3 mb-3">
      <KOLHoverCard
        kolId={authorId}
        screenName={displayName}
        profileImageUrl={authorAvatar || undefined}
        platform="xiaohongshu"
        initialTracked={initialTracked}
        onTrackChange={onTrackChange}
      >
        <Avatar className="w-8 h-8 flex-shrink-0 cursor-pointer">
          <AvatarImage
            src={proxyImageUrl(authorAvatar || "")}
            alt={displayName}
            className="object-cover"
          />
          <AvatarFallback className="bg-gradient-to-br from-rose-400 to-pink-500 text-white text-xs font-bold">
            {displayName.substring(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </KOLHoverCard>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center">
          <KOLHoverCard
            kolId={authorId}
            screenName={displayName}
            profileImageUrl={authorAvatar || undefined}
            platform="xiaohongshu"
            initialTracked={initialTracked}
            onTrackChange={onTrackChange}
          >
            <span className="hover:underline cursor-pointer">
              {displayName}
            </span>
          </KOLHoverCard>
          <span className="text-gray-500 dark:text-white/50 font-normal text-xs ml-1 flex items-center gap-1">
            <Image
              src="/logo/xiaohongshu.svg"
              alt="Xiaohongshu"
              width={12}
              height={12}
              className="w-3 h-3"
            />{" "}
            · {onFormatDate(createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
