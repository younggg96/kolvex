"use client";

import React, { useState, useEffect } from "react";
import { KOLPost } from "@/lib/kolPostsApi";
import YouTubeVideoHeader from "./YouTubeVideoHeader";
import YouTubeVideoContent from "./YouTubeVideoContent";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import SentimentBadge from "@/components/common/SentimentBadge";

interface YouTubeVideoFeedListProps {
  posts: KOLPost[];
  formatDate?: (dateString: string) => string;
}

export default function YouTubeVideoFeedList({
  posts,
  formatDate,
}: YouTubeVideoFeedListProps) {
  const [mounted, setMounted] = useState(false);
  const [expandedNonStockPosts, setExpandedNonStockPosts] = useState<Set<number>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  const isStockRelated = (post: KOLPost): boolean => {
    if (!post.is_stock_related) return true;
    return post.is_stock_related.is_related === true;
  };

  const toggleNonStockPost = (postId: number) => {
    setExpandedNonStockPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const defaultFormatDate = (dateString: string) => {
    if (!mounted) return new Date(dateString).toLocaleDateString();
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(dateString).toLocaleDateString();
  };

  const fmt = formatDate || defaultFormatDate;

  return (
    <div className="flex flex-col gap-0 max-w-2xl mx-auto w-full">
      {posts.map((post, index) => {
        const stockRelated = isStockRelated(post);
        const isExpanded = expandedNonStockPosts.has(post.id);

        if (!stockRelated && !isExpanded) {
          return (
            <React.Fragment key={post.id}>
              <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-3 h-3" />
                  <span>
                    <span className="font-medium">{post.username}</span>
                    {" "}&middot;{" "}
                    {post.title
                      ? post.title.slice(0, 50) + (post.title.length > 50 ? "..." : "")
                      : "Video"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => toggleNonStockPost(post.id)}
                >
                  Show
                </Button>
              </div>
              {index < posts.length - 1 && <Separator />}
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={post.id}>
            <div className="px-4 py-4">
              <YouTubeVideoHeader
                channelName={post.display_name || post.username}
                createdAt={post.created_at || post.scraped_at || ""}
                avatarUrl={post.avatar_url || undefined}
                onFormatDate={fmt}
                kolId={post.author_platform_id || undefined}
                rightContent={
                  post.sentiment ? (
                    <SentimentBadge sentiment={post.sentiment} />
                  ) : null
                }
              />
              <YouTubeVideoContent post={post} />
            </div>
            {index < posts.length - 1 && <Separator />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
