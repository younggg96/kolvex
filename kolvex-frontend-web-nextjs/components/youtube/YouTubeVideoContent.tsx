"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { KOLPost } from "@/lib/kolPostsApi";
import { ExternalLink, Eye, ThumbsUp, MessageSquare, Play } from "lucide-react";
import Tags from "@/components/common/Tags";
import AIAnalysis from "@/components/common/AIAnalysis";

interface YouTubeVideoContentProps {
  post: KOLPost;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatText(text: string): React.ReactNode {
  return text.split(/(\s+)/).map((word, i) => {
    if (word.startsWith("$") && word.length > 1) {
      const ticker = word.slice(1).replace(/[.,!?;:'")\]]+$/, "").toUpperCase();
      return (
        <Link
          key={i}
          href={`/dashboard/stock/${ticker}`}
          className="text-red-500 hover:text-red-400 hover:underline cursor-pointer"
        >
          {word}
        </Link>
      );
    }
    if (word.startsWith("#")) {
      return (
        <span key={i} className="text-red-500">
          {word}
        </span>
      );
    }
    return word;
  });
}

export default function YouTubeVideoContent({ post }: YouTubeVideoContentProps) {
  const [showEmbed, setShowEmbed] = useState(false);

  const videoId = post.platform_post_id;
  const thumbnailUrl = post.cover_url;
  const videoUrl = post.permalink || post.video_url;

  return (
    <div className="space-y-3">
      {/* AI Tags */}
      {post.ai_tags && post.ai_tags.length > 0 && (
        <Tags tags={post.ai_tags} />
      )}

      {/* Video title */}
      {post.title && (
        <h3 className="font-semibold text-sm leading-snug text-foreground">
          {formatText(post.title)}
        </h3>
      )}

      {/* Video thumbnail / embed */}
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
        {showEmbed && videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={post.title || "YouTube Video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            className="relative w-full h-full group cursor-pointer"
            onClick={() => setShowEmbed(true)}
            aria-label="Play video"
          >
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={post.title || "Video thumbnail"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 600px"
              />
            ) : (
              <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                <Play className="w-12 h-12 text-white/60" />
              </div>
            )}
            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Description (truncated) */}
      {post.content && (
        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">
          {formatText(post.content)}
        </p>
      )}

      {/* Engagement stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {post.views_count > 0 && (
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {formatCount(post.views_count)}
          </span>
        )}
        {post.like_count > 0 && (
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-3.5 h-3.5" />
            {formatCount(post.like_count)}
          </span>
        )}
        {post.reply_count > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {formatCount(post.reply_count)}
          </span>
        )}
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 hover:text-red-500 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>YouTube</span>
          </a>
        )}
      </div>

      {/* AI Analysis accordion */}
      <AIAnalysis
        summary={post.summary}
        tradingSignal={post.trading_signal}
        model={post.ai_model}
        analyzedAt={post.ai_analyzed_at}
      />
    </div>
  );
}
