"use client";

import React, { useState, useEffect } from "react";
import { UnifiedPost } from "@/lib/postTypes";
import TweetHeader from "./TweetHeader";
import {
  TwitterContent,
  RedditContent,
  YouTubeContent,
  RednoteContent,
} from "./content";
import { Separator } from "./ui/separator";
import type { Platform } from "@/lib/supabase/database.types";

// Helper function to map post platform to database Platform type
const mapPlatform = (platform: string): Platform | undefined => {
  const platformMap: Record<string, Platform> = {
    x: "TWITTER",
    reddit: "REDDIT",
    youtube: "YOUTUBE",
    rednote: "REDNOTE",
  };
  return platformMap[platform];
};

interface PostFeedListProps {
  posts: UnifiedPost[];
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

  const renderPostContent = (post: UnifiedPost) => {
    switch (post.platform) {
      case "x":
        return (
          <TwitterContent
            title={post.title}
            fullText={post.content}
            url={post.url}
            id={post.id.split("_")[1] || post.id}
            mediaUrls={post.mediaUrls}
            aiSummary={post.aiSummary}
            aiAnalysis={post.aiAnalysis}
            aiTags={post.aiTags}
            sentiment={post.sentiment}
            onFormatText={onFormatText}
            likesCount={post.likes}
            userLiked={post.userLiked}
            userFavorited={post.userFavorited}
            totalLikes={post.totalLikes}
            totalFavorites={post.totalFavorites}
          />
        );
      case "reddit":
        return (
          <RedditContent
            title={post.title}
            fullText={post.content}
            url={post.url}
            id={post.id}
            mediaUrls={post.mediaUrls}
            aiSummary={post.aiSummary}
            aiAnalysis={post.aiAnalysis}
            aiTags={post.aiTags}
            sentiment={post.sentiment}
            onFormatText={onFormatText}
            subreddit={post.platformData?.subreddit}
            score={post.platformData?.score}
            permalink={post.platformData?.permalink}
            topComments={post.platformData?.topComments}
            likesCount={post.likes}
            userLiked={post.userLiked}
            userFavorited={post.userFavorited}
            totalLikes={post.totalLikes}
            totalFavorites={post.totalFavorites}
          />
        );
      case "youtube":
        return (
          <YouTubeContent
            title={post.title}
            fullText={post.content}
            url={post.url}
            id={post.id}
            mediaUrls={post.mediaUrls}
            aiSummary={post.aiSummary}
            aiAnalysis={post.aiAnalysis}
            aiTags={post.aiTags}
            sentiment={post.sentiment}
            onFormatText={onFormatText}
            viewCount={post.platformData?.viewCount}
            likeCount={post.platformData?.likeCount}
            commentCount={post.platformData?.commentCount}
            duration={post.platformData?.duration}
            thumbnailUrl={post.platformData?.thumbnailUrl}
            channelName={post.platformData?.channelName}
            channelThumbnailUrl={post.platformData?.channelThumbnailUrl}
            publishedAt={post.platformData?.publishedAt}
            likesCount={post.likes}
            userLiked={post.userLiked}
            userFavorited={post.userFavorited}
            totalLikes={post.totalLikes}
            totalFavorites={post.totalFavorites}
          />
        );
      case "rednote":
        return (
          <RednoteContent
            title={post.title}
            fullText={post.content}
            url={post.url}
            id={post.id}
            mediaUrls={post.mediaUrls}
            aiSummary={post.aiSummary}
            aiAnalysis={post.aiAnalysis}
            aiTags={post.aiTags}
            sentiment={post.sentiment}
            onFormatText={onFormatText}
            likesCount={post.likes}
            userLiked={post.userLiked}
            userFavorited={post.userFavorited}
            totalLikes={post.totalLikes}
            totalFavorites={post.totalFavorites}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {posts.map((post, index) => {
        if (!post.isMarketRelated) return null;

        return (
          <div key={post.id}>
            <TweetHeader
              screenName={post.author}
              createdAt={post.createdAt}
              profileImageUrl={post.avatarUrl}
              onFormatDate={onFormatDate}
              kolId={post.authorId}
              platform={mapPlatform(post.platform)}
              initialTracked={post.userTracked}
            />

            {renderPostContent(post)}

            {index < posts.length - 1 && <Separator className="my-2" />}
          </div>
        );
      })}
    </>
  );
}
