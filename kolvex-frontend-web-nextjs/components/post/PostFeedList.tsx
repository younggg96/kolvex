"use client";

import React, { useState, useEffect } from "react";
import { KOLPost } from "@/lib/kolPostsApi";
import PostHeader from "@/components/post/PostHeader";
import PostContent from "@/components/post/PostContent";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import SentimentBadge from "../common/SentimentBadge";
import PostDetailModal from "@/components/post/PostDetailModal";

interface PostFeedListProps {
  posts: KOLPost[];
  formatDate?: (dateString: string) => string;
  formatText?: (text: string) => React.ReactNode;
}

export default function PostFeedList({ posts, formatDate }: PostFeedListProps) {
  const [mounted, setMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<KOLPost | null>(null);
  const [expandedNonStockPosts, setExpandedNonStockPosts] = useState<
    Set<number>
  >(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // check if the post is stock related
  const isStockRelated = (post: KOLPost): boolean => {
    // if there is no is_stock_related field, default to true for backward compatibility
    if (!post.is_stock_related) return true;
    return post.is_stock_related.is_related === true;
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
            className="text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {word}
          </Link>
        );
      }
      if (word.startsWith("#")) {
        return (
          <span key={index} className="text-sky-400">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  const onFormatDate = formatDate || defaultFormatDate;
  const onFormatText = defaultFormatText;

  const renderPostContent = (post: KOLPost) => {
    return (
      <PostContent
        fullText={post.content}
        url={post.permalink || ""}
        id={post.id.toString()}
        mediaUrls={post.media_urls?.map((m) => m.url || "") || []}
        aiSummary={post.summary}
        aiTradingSignal={post.trading_signal}
        aiTags={post.ai_tags || []}
        aiModel={post.ai_model}
        aiAnalyzedAt={post.ai_analyzed_at}
        sentiment={post.sentiment}
        onFormatText={onFormatText}
        likesCount={post.like_count}
      />
    );
  };

  const renderCollapsedNonStockPost = (post: KOLPost) => {
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
              <>
                <PostHeader
                  screenName={post.username}
                  createdAt={post.created_at || new Date().toISOString()}
                  profileImageUrl={post.avatar_url || undefined}
                  onFormatDate={onFormatDate}
                  kolId={post.username}
                  platform={post.platform}
                  initialTracked={false}
                />
                {renderCollapsedNonStockPost(post)}
              </>
            ) : (
              <>
                <PostHeader
                  screenName={post.username}
                  createdAt={post.created_at || new Date().toISOString()}
                  profileImageUrl={post.avatar_url || undefined}
                  onFormatDate={onFormatDate}
                  kolId={post.username}
                  platform={post.platform}
                  initialTracked={false}
                  rightContent={
                    <div className="flex items-center gap-2 my-2">
                      <SentimentBadge sentiment={post.sentiment} />
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setSelectedPost(post);
                          setIsModalOpen(true);
                        }}
                        className="text-primary hover:!bg-primary/10 gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        <span className="sm:block hidden">Details</span>
                      </Button>
                    </div>
                  }
                />
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
                        Unrelated to stocks. Click to hide
                      </span>
                    </Button>
                  </div>
                )}
                {renderPostContent(post)}
              </>
            )}
            {index < posts.length - 1 && <Separator className="my-2" />}
          </div>
        );
      })}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPost(null);
          }}
          postUrl={selectedPost.permalink || ""}
          postPermalink={selectedPost.permalink || undefined}
        />
      )}
    </>
  );
}
