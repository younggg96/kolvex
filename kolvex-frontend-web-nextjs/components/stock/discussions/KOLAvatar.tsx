"use client";

import { Badge } from "@/components/ui/badge";
import KOLHoverCard from "@/components/kol/KOLHoverCard";
import { KOLSummary } from "@/lib/kolTweetsApi";

interface KOLAvatarProps {
  kol: KOLSummary;
}

export default function KOLAvatar({ kol }: KOLAvatarProps) {
  const avatarContent = (
    <div className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer group">
      <div className="relative">
        {/* 波纹动画背景 */}
        <div className="absolute inset-0 rounded-full">
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping [animation-duration:2s]" />
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-pulse [animation-duration:1.5s]" />
        </div>
        {kol.avatar_url ? (
          <img
            src={kol.avatar_url}
            alt={kol.username}
            className="relative w-10 h-10 rounded-full object-cover ring-2 ring-primary/30 group-hover:ring-primary/50 transition-all"
          />
        ) : (
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center ring-2 ring-primary/30 group-hover:ring-primary/50 transition-all">
            <span className="text-sm font-semibold text-primary">
              {kol.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {/* 推文数量 badge */}
        <Badge className="absolute -top-0.5 -right-0.5 z-10 !w-[14px] !h-[14px] rounded-full !p-0 !text-[10px] justify-center bg-primary text-white border-primary/20">
          {kol.tweet_count}
        </Badge>
      </div>
      <span className="text-xs text-muted-foreground truncate max-w-[60px] group-hover:text-primary transition-colors">
        @{kol.username}
      </span>
    </div>
  );

  return (
    <KOLHoverCard
      kolId={kol.username}
      screenName={kol.username}
      profileImageUrl={kol.avatar_url || undefined}
      platform="TWITTER"
    >
      {avatarContent}
    </KOLHoverCard>
  );
}

