"use client";

import { useState } from "react";
import { Heart, Repeat2, MessageCircle, ExternalLink, Copy, Check } from "lucide-react";
import {
  KOLTweet,
  getCategoryInfo,
  formatNumber,
  formatTimeAgo,
} from "@/lib/kolTweetsApi";
import { cn, proxyImageUrl } from "@/lib/utils";

interface KOLTweetCardProps {
  tweet: KOLTweet;
  showCategory?: boolean;
}

export default function KOLTweetCard({
  tweet,
  showCategory = true,
}: KOLTweetCardProps) {
  const [copied, setCopied] = useState(false);
  const categoryInfo = getCategoryInfo(tweet.category);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tweet.tweet_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleOpenTweet = () => {
    if (tweet.permalink) {
      window.open(tweet.permalink, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="group relative rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 hover:border-border hover:bg-card/80 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {tweet.avatar_url ? (
            <img
              src={proxyImageUrl(tweet.avatar_url)}
              alt={tweet.username}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-border/50"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center ring-2 ring-border/50">
              <span className="text-sm font-semibold text-primary">
                {tweet.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {/* Category badge */}
          {showCategory && categoryInfo && (
            <span
              className="absolute -bottom-1 -right-1 text-xs"
              title={categoryInfo.name}
            >
              {categoryInfo.icon}
            </span>
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate">
              {tweet.display_name || tweet.username}
            </span>
            <span className="text-muted-foreground text-sm truncate">
              @{tweet.username}
            </span>
          </div>
          {tweet.kol_description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {tweet.kol_description}
            </p>
          )}
        </div>

        {/* Time */}
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {formatTimeAgo(tweet.scraped_at)}
        </span>
      </div>

      {/* Tweet Content */}
      <div className="mb-3">
        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
          {tweet.tweet_text}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/30">
        {/* Stats */}
        <div className="flex items-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-1.5 text-xs">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>{formatNumber(tweet.reply_count)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Repeat2 className="w-3.5 h-3.5" />
            <span>{formatNumber(tweet.retweet_count)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Heart className="w-3.5 h-3.5" />
            <span>{formatNumber(tweet.like_count)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="复制内容"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          {tweet.permalink && (
            <button
              onClick={handleOpenTweet}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="在 X 上查看"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 骨架屏组件
export function KOLTweetCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1">
          <div className="h-4 bg-muted rounded w-1/3 mb-2" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
        <div className="h-3 bg-muted rounded w-16" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-4/5" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
      <div className="flex gap-4 pt-3 border-t border-border/30">
        <div className="h-3 bg-muted rounded w-12" />
        <div className="h-3 bg-muted rounded w-12" />
        <div className="h-3 bg-muted rounded w-12" />
      </div>
    </div>
  );
}

