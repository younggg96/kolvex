"use client";

import { useState } from "react";
import {
  ExternalLink,
  Heart,
  Bookmark,
  MessageCircle,
  Share2,
} from "lucide-react";
import Tags from "@/components/common/Tags";
import SentimentBadge from "@/components/common/SentimentBadge";
import AIAnalysis from "@/components/common/AIAnalysis";
import ImageGallery from "@/components/common/ImageGallery";
import VideoPlayer from "@/components/common/VideoPlayer";
import { XhsPost } from "@/lib/xhsApi";
import { formatNumber, getXhsPermalink } from "@/lib/xhsApi";
import Image from "next/image";

interface XhsContentProps {
  post: XhsPost;
  onFormatText: (text: string) => React.ReactNode;
}

export default function XhsContent({ post, onFormatText }: XhsContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const permalink = post.permalink || getXhsPermalink(post.note_id);
  const contentText = post.content || "";
  const shouldShowMore = contentText.length > 150;

  // 构建 sentiment 对象
  const sentiment = post.ai_sentiment
    ? {
        value: post.ai_sentiment,
        confidence: post.ai_sentiment_confidence,
        reasoning: post.ai_sentiment_reasoning,
      }
    : null;

  // 构建 tradingSignal 对象
  // ai_trading_signal 可能是字符串（旧格式）或对象（新格式 JSONB）
  const buildTradingSignal = () => {
    if (!post.ai_trading_signal) return null;

    // 如果是对象格式 {"action": "buy"}
    if (typeof post.ai_trading_signal === "object") {
      const signal = post.ai_trading_signal as { action?: string };
      return {
        action: (signal.action || null) as "buy" | "sell" | "hold" | null,
        tickers: post.ai_tickers || [],
        confidence: null,
        reasoning: null,
      };
    }

    // 如果是字符串格式 "buy"
    return {
      action: post.ai_trading_signal as "buy" | "sell" | "hold" | null,
      tickers: post.ai_tickers || [],
      confidence: null,
      reasoning: null,
    };
  };

  const tradingSignal = buildTradingSignal();

  return (
    <div className="space-y-2 mb-1">
      {/* Tags and Sentiment */}
      <div className="flex items-center justify-between gap-2 flex-wrap my-2">
        {post.ai_tags && post.ai_tags.length > 0 && (
          <Tags tags={post.ai_tags} />
        )}
        <div className="flex items-center gap-2">
          <SentimentBadge sentiment={sentiment} />
        </div>
      </div>

      {/* Title */}
      {post.title && (
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
          {post.title}
        </h3>
      )}

      {/* Content Text - 只在有内容时显示 */}
      {contentText && contentText.trim() !== (post.title || "").trim() && (
        <div className="relative">
          <div
            className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap ${
              !isExpanded ? "line-clamp-4" : ""
            }`}
          >
            {onFormatText(contentText)}
          </div>
          {shouldShowMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-primary hover:text-primary/80 font-medium mt-1"
            >
              {isExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* 图片 */}
      {post.image_urls && post.image_urls.length > 0 ? (
        <ImageGallery imageUrls={post.image_urls} />
      ) : (
        <ImageGallery imageUrls={post.cover_url ? [post.cover_url] : []} />
      )}

      {/* 视频 */}
      {post.video_url && (
        <VideoPlayer
          videoUrl={post.video_url}
          coverUrl={post.cover_url || undefined}
          permalink={permalink}
        />
      )}

      {/* Engagement Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1">
        <div className="flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" />
          <span>{formatNumber(post.like_count)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Bookmark className="w-3.5 h-3.5" />
          <span>{formatNumber(post.collect_count)}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" />
          <span>{formatNumber(post.comment_count)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Share2 className="w-3.5 h-3.5" />
          <span>{formatNumber(post.share_count)}</span>
        </div>
      </div>

      {/* AI Analysis (Summary & Trading Signal) */}
      <AIAnalysis
        summary={post.ai_summary}
        tradingSignal={tradingSignal}
        model={post.ai_model}
        analyzedAt={post.ai_analyzed_at}
      />
    </div>
  );
}
