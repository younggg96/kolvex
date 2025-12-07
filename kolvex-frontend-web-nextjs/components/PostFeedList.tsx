"use client";

import React, { useState, useEffect } from "react";
import { KOLTweet } from "@/lib/kolTweetsApi";
import TweetHeader from "./TweetHeader";
import { TwitterContent } from "./content";
import { Separator } from "./ui/separator";
import type { Platform } from "@/lib/supabase/database.types";

// Helper function to map post platform to database Platform type
const mapPlatform = (platform: string): Platform | undefined => {
  // Since we only support TWITTER now, and backend might not return platform field in KOLTweet
  // We default to TWITTER for now or check if there's a platform field
  return "TWITTER";
};

interface PostFeedListProps {
  posts: KOLTweet[];
  formatDate?: (dateString: string) => string;
  formatText?: (text: string) => React.ReactNode;
}

export default function PostFeedList({
  posts,
  formatDate,
  formatText,
}: PostFeedListProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultFormatDate = (dateString: string) => {
    if (!mounted) {
      // Return a static format during SSR to prevent hydration mismatch
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
      if (word.startsWith("#") || word.startsWith("$")) {
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
  const onFormatText = formatText || defaultFormatText;

  const renderPostContent = (post: KOLTweet) => {
    return (
      <TwitterContent
        fullText={post.tweet_text}
        url={post.permalink || ""}
        id={post.id.toString()}
        mediaUrls={post.media_urls?.map((m) => m.url || "") || []}
        aiSummary={post.summary}
        aiTradingSignal={post.trading_signal}
        aiTags={post.tags}
        aiModel={post.ai_model}
        aiAnalyzedAt={post.ai_analyzed_at}
        sentiment={post.sentiment}
        onFormatText={onFormatText}
        likesCount={post.like_count}
      />
    );
  };

  return (
    <>
      {posts.map((post, index) => (
        <div key={post.id}>
          <TweetHeader
            screenName={post.username}
            createdAt={post.created_at || new Date().toISOString()}
            profileImageUrl={post.avatar_url || undefined}
            onFormatDate={onFormatDate}
            kolId={post.username}
            platform={mapPlatform("x")}
            initialTracked={false}
          />
          {renderPostContent(post)}
          {index < posts.length - 1 && <Separator className="my-2" />}
        </div>
      ))}
    </>
  );
}
