"use client";

import { useState, useEffect } from "react";
import {
  ExternalLink,
  Eye,
  ThumbsUp,
  MessageCircle,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ContentWithModal from "../ContentWithModal";
import ExpandableText from "../ExpandableText";
import AIAnalysis from "../AIAnalysis";
import Tags from "../Tags";
import PostActions from "../PostActions";
import { YouTubeContentProps } from "./types";

export default function YouTubeContent({
  title,
  fullText,
  url,
  id,
  mediaUrls,
  aiSummary,
  aiAnalysis,
  aiTags,
  sentiment,
  onFormatText,
  viewCount,
  likeCount,
  commentCount,
  duration,
  thumbnailUrl,
  channelName,
  channelThumbnailUrl,
  publishedAt,
  likesCount,
  userLiked,
  userFavorited,
  totalLikes,
  totalFavorites,
}: YouTubeContentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const summary = aiSummary || "";

  // Extract video ID from post_id (format: youtube_VIDEO_ID)
  const videoId = id.startsWith("youtube_") ? id.substring(8) : id;

  // Format numbers with K/M suffix
  const formatNumber = (num?: number) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Format duration from seconds to MM:SS or HH:MM:SS
  const formatDuration = (seconds?: string) => {
    if (!seconds) return "";
    const sec = parseInt(seconds);
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Format published date
  const formatPublishedDate = (dateStr?: string) => {
    if (!dateStr) return "";
    if (!mounted) {
      // Return a static format during SSR to prevent hydration mismatch
      return new Date(dateStr).toLocaleDateString();
    }

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <>
      <div className="space-y-3 mb-3">
        {/* Video Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-white/60">
          {viewCount !== undefined && (
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{formatNumber(viewCount)}</span>
            </div>
          )}
          {likeCount !== undefined && (
            <div className="flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{formatNumber(likeCount)}</span>
            </div>
          )}
          {commentCount !== undefined && (
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{formatNumber(commentCount)}</span>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="text-xs text-gray-600 dark:text-white/60">
          <span className="font-medium">Summary: </span>
          {summary}
        </div>

        {/* Video Description */}
        <ContentWithModal
          onOpenModal={() => setIsModalOpen(true)}
          ariaLabel="Open video in modal"
        >
          <ExpandableText
            text={fullText}
            maxWords={80}
            onFormatText={onFormatText}
          />
        </ContentWithModal>

        {/* Tags */}
        <Tags tags={aiTags || []} />

        {/* AI Analysis */}
        <AIAnalysis aiAnalysis={aiAnalysis} sentiment={sentiment} />
      </div>

      {/* Post Actions */}
      <PostActions
        postId={id}
        postUrl={url}
        liked={userLiked}
        favorited={userFavorited}
        likesCount={totalLikes}
        favoritesCount={totalFavorites}
      />

      {/* YouTube Embed Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[600px] w-[95vw] h-fit max-h-[90vh] overflow-hidden !p-0 bg-white dark:bg-card-dark rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-gray-900 dark:text-white">
              YouTube Video
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto p-2 max-h-[calc(90vh-80px)] bg-white dark:bg-card-dark rounded-2xl">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              width="100%"
              height={500}
              frameBorder="0"
              className="rounded-xl bg-white dark:bg-card-dark"
              style={{ border: "none" }}
              allowFullScreen
            />
          </div>
          <DialogFooter className="px-6 pt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              View on YouTube
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
