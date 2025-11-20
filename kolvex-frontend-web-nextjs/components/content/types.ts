// Common types for all platform content components

export interface RedditComment {
  score: number;
  comment_id: string;
  body: string;
  created_utc: number;
  author: string;
}

export interface BaseContentProps {
  title?: string;
  fullText: string;
  url: string;
  id: string;
  mediaUrls: string[];
  aiSummary?: string;
  aiAnalysis?: string;
  aiTags?: string[];
  sentiment?: "bullish" | "bearish" | "neutral";
  onFormatText: (text: string) => React.ReactNode;
  likesCount?: number;
  // User interaction data
  userLiked?: boolean;
  userFavorited?: boolean;
  totalLikes?: number;
  totalFavorites?: number;
}

export interface TwitterContentProps extends BaseContentProps {
  // Twitter-specific props can be added here
}

export interface RedditContentProps extends BaseContentProps {
  subreddit?: string;
  score?: number;
  permalink?: string;
  topComments?: RedditComment[];
}

export interface YouTubeContentProps extends BaseContentProps {
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  duration?: string;
  thumbnailUrl?: string;
  channelName?: string;
  channelThumbnailUrl?: string;
  publishedAt?: string;
}

export interface RednoteContentProps extends BaseContentProps {
  // Rednote-specific props can be added here
}
