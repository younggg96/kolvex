"use client";

import React, { useState, useEffect } from "react";
import { XhsPost } from "@/lib/xhsApi";
import XhsPostHeader from "./XhsPostHeader";
import XhsContent from "./XhsContent";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

interface XhsPostFeedListProps {
  posts: XhsPost[];
  formatDate?: (dateString: string) => string;
  formatText?: (text: string) => React.ReactNode;
  profileAvatar?: string | null;
}

export default function XhsPostFeedList({
  posts,
  formatDate,
  formatText,
  profileAvatar,
}: XhsPostFeedListProps) {
  const [mounted, setMounted] = useState(false);
  // track which "non-stock related" posts have been manually expanded
  const [expandedNonStockPosts, setExpandedNonStockPosts] = useState<
    Set<number>
  >(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // check if the post is stock related
  const isStockRelated = (post: XhsPost): boolean => {
    return post.ai_is_stock_related === true;
  };

  // toggle the expanded state of the non-stock related posts
  const toggleNonStockPost = (postId: number) => {
    setExpandedNonStockPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const defaultFormatDate = (dateString: string) => {
    if (!mounted) {
      return new Date(dateString).toLocaleDateString();
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  const defaultFormatText = (text: string) => {
    return text.split(/(\s+)/).map((word, index) => {
      if (word.startsWith("$") && word.length > 1) {
        const ticker = word
          .slice(1)
          .replace(/[.,!?;:'")\]]+$/, "")
          .toUpperCase();
        return (
          <Link
            key={index}
            href={`/dashboard/stock/${ticker}`}
            className="text-rose-500 hover:text-rose-400 hover:underline cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {word}
          </Link>
        );
      }
      if (word.startsWith("#")) {
        return (
          <span key={index} className="text-rose-500">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  const onFormatDate = formatDate || defaultFormatDate;
  const onFormatText = formatText || defaultFormatText;

  // render the collapsed non-stock related post hint
  const renderCollapsedNonStockPost = (post: XhsPost) => {
    return (
      <div className="py-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => toggleNonStockPost(post.id)}
          className="w-fit h-6 gap-1.5 text-amber-600/80 hover:bg-amber-50 dark:text-amber-500/80 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 font-normal"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            <span className="text-xs">
              This post is unrelated to stocks. Click to view
            </span>
          </div>
        </Button>
      </div>
    );
  };

  return (
    <>
      {posts.map((post, index) => {
        const stockRelated = isStockRelated(post);
        const isExpanded = expandedNonStockPosts.has(post.id);
        const shouldCollapse = !stockRelated && !isExpanded;

        return (
          <div key={post.id}>
            {shouldCollapse ? (
              // collapsed state: only show the header and the hint
              <>
                <XhsPostHeader
                  authorName={post.author_name || ""}
                  authorId={post.author_id || ""}
                  createdAt={
                    post.scraped_at ||
                    post.created_at ||
                    new Date().toISOString()
                  }
                  authorAvatar={
                    profileAvatar || post.author_avatar || undefined
                  }
                  onFormatDate={onFormatDate}
                  initialTracked={false}
                />
                {renderCollapsedNonStockPost(post)}
              </>
            ) : (
              // normal state or expanded state
              <>
                <XhsPostHeader
                  authorName={post.author_name || ""}
                  authorId={post.author_id || ""}
                  createdAt={
                    post.scraped_at ||
                    post.created_at ||
                    new Date().toISOString()
                  }
                  authorAvatar={
                    profileAvatar || post.author_avatar || undefined
                  }
                  onFormatDate={onFormatDate}
                  initialTracked={false}
                />
                {/* if the post is expanded and non-stock related, show the collapse button */}
                {!stockRelated && isExpanded && (
                  <div className="py-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleNonStockPost(post.id)}
                      className="w-fit h-6 gap-1.5 text-amber-600/80 hover:bg-amber-50 dark:text-amber-500/80 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 font-normal"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span className="text-xs">
                        This post is unrelated to stocks. Click to hide
                      </span>
                    </Button>
                  </div>
                )}
                <XhsContent post={post} onFormatText={onFormatText} />
              </>
            )}
            {index < posts.length - 1 && <Separator className="my-2" />}
          </div>
        );
      })}
    </>
  );
}
