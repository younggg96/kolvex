"use client";

import { useEffect, useState } from "react";
import { StockTweet } from "@/lib/kolTweetsApi";
import TweetHeader from "@/components/tweet/TweetHeader";
import { TwitterContent } from "@/components/tweet/content";

interface TweetCardProps {
  tweet: StockTweet;
}

export default function TweetCard({ tweet }: TweetCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatDate = (dateString: string) => {
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

  const formatText = (text: string) => {
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

  return (
    <div className="space-y-2">
      <TweetHeader
        screenName={tweet.username}
        createdAt={tweet.created_at || new Date().toISOString()}
        profileImageUrl={tweet.avatar_url || undefined}
        onFormatDate={formatDate}
        kolId={tweet.username}
        platform="TWITTER"
        initialTracked={false}
      />
      <TwitterContent
        fullText={tweet.tweet_text}
        url={tweet.permalink || ""}
        id={tweet.id.toString()}
        mediaUrls={tweet.media_urls?.map((m) => m.url || "") || []}
        aiSummary={tweet.summary}
        aiTradingSignal={tweet.trading_signal}
        aiTags={tweet.tags}
        aiModel={tweet.ai_model}
        aiAnalyzedAt={tweet.ai_analyzed_at}
        sentiment={tweet.sentiment}
        onFormatText={formatText}
        likesCount={tweet.like_count}
      />
    </div>
  );
}

