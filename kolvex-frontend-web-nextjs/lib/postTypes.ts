// Unified post interface for all platforms
export interface UnifiedPost {
  id: string;
  platform: "x" | "reddit" | "youtube" | "rednote";
  author: string;
  authorId: string;
  avatarUrl: string;
  // Creator info from creators table
  authorUsername?: string;
  authorVerified?: boolean;
  authorBio?: string | null;
  authorFollowersCount?: number;
  authorCategory?: string | null;
  authorInfluenceScore?: number;
  authorTrendingScore?: number;
  title?: string; // For Reddit and YouTube
  content: string;
  url: string;
  createdAt: string;
  likes: number;
  comments: number;
  shares?: number;
  mediaUrls: string[];
  videoUrl?: string;
  aiSummary: string;
  aiAnalysis: string;
  aiTags: string[];
  aiAnalyzedAt?: string | null;
  aiModel?: string | null;
  sentiment: "bullish" | "bearish" | "neutral";
  isMarketRelated: boolean;
  // User interaction data
  userLiked?: boolean;
  userFavorited?: boolean;
  userTracked?: boolean;
  totalLikes?: number;
  totalFavorites?: number;
  favoriteId?: string; // Favorite record ID
  likedAt?: string; // When user liked this post
  favoritedAt?: string; // When user favorited this post
  // Platform-specific data
  platformData?: {
    // For Reddit
    subreddit?: string;
    score?: number;
    permalink?: string;
    topComments?: Array<{
      score: number;
      comment_id: string;
      body: string;
      created_utc: number;
      author: string;
    }>;
    // For YouTube
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    duration?: string;
    thumbnailUrl?: string;
    channelName?: string;
    channelThumbnailUrl?: string;
    publishedAt?: string;
  };
}

// Helper function to map API sentiment to UI sentiment
function mapSentiment(apiSentiment: string): "bullish" | "bearish" | "neutral" {
  switch (apiSentiment) {
    case "positive":
      return "bullish";
    case "negative":
      return "bearish";
    default:
      return "neutral";
  }
}

// Conversion functions
export function tweetToUnifiedPost(tweet: any): UnifiedPost {
  return {
    id: tweet.post_id,
    platform: "x",
    author: tweet.screen_name || tweet.creator_name,
    authorId: tweet.user_id || tweet.creator_id,
    avatarUrl: tweet.profile_image_url || tweet.creator_avatar_url,
    content: tweet.full_text || tweet.content,
    url: tweet.tweet_url || tweet.content_url,
    createdAt: tweet.created_at || tweet.published_at,
    likes: tweet.num_likes || tweet.likes_count,
    comments: 0,
    mediaUrls: tweet.media_urls || [],
    aiSummary: tweet.ai_summary,
    aiAnalysis: tweet.ai_analysis,
    aiTags: tweet.ai_tags || [],
    aiAnalyzedAt: tweet.ai_analyzed_at,
    aiModel: tweet.ai_model,
    sentiment: mapSentiment(tweet.ai_sentiment),
    isMarketRelated: tweet.is_market_related,
    userLiked: tweet.user_liked,
    userFavorited: tweet.user_favorited,
    userTracked: tweet.user_tracked,
    totalLikes: tweet.total_likes,
    totalFavorites: tweet.total_favorites,
  };
}

export function redditPostToUnifiedPost(post: any): UnifiedPost {
  return {
    id: post.post_id,
    platform: "reddit",
    author: post.username,
    authorId: post.user_id,
    avatarUrl: post.user_avatar_url,
    title: post.title,
    content: post.selftext,
    url: post.permalink,
    createdAt: new Date(parseInt(post.created_utc) * 1000).toISOString(),
    likes: post.score,
    comments: post.num_comments,
    mediaUrls: [],
    aiSummary: post.ai_summary,
    aiAnalysis: post.ai_analysis,
    aiTags: post.ai_tags || [],
    sentiment: mapSentiment(post.ai_sentiment),
    isMarketRelated: post.is_market_related,
    userLiked: post.user_liked,
    userFavorited: post.user_favorited,
    userTracked: post.user_tracked,
    totalLikes: post.total_likes,
    totalFavorites: post.total_favorites,
    platformData: {
      subreddit: post.subreddit,
      score: post.score,
      permalink: post.permalink,
      topComments: post.top_comments,
    },
  };
}

export function youtubeVideoToUnifiedPost(video: any): UnifiedPost {
  return {
    id: video.post_id,
    platform: "youtube",
    author: video.channel_name,
    authorId: video.channel_id,
    avatarUrl: video.channel_thumbnail_url || video.channel_avatar_url,
    title: video.title,
    content: video.description,
    url: video.video_url,
    createdAt: video.published_at,
    likes: video.like_count,
    comments: video.comment_count || 0,
    mediaUrls: video.thumbnail_url ? [video.thumbnail_url] : [],
    videoUrl: video.video_url,
    aiSummary: video.ai_summary,
    aiAnalysis: video.ai_analysis,
    aiTags: video.ai_tags || [],
    sentiment: mapSentiment(video.ai_sentiment),
    isMarketRelated: video.is_market_related,
    userLiked: video.user_liked,
    userFavorited: video.user_favorited,
    userTracked: video.user_tracked,
    totalLikes: video.total_likes,
    totalFavorites: video.total_favorites,
    platformData: {
      viewCount: video.view_count,
      likeCount: video.like_count,
      commentCount: video.comment_count,
      duration: video.duration_seconds?.toString() || video.duration,
      thumbnailUrl: video.thumbnail_url,
      channelName: video.channel_name,
      channelThumbnailUrl: video.channel_thumbnail_url,
      publishedAt: video.published_at,
    },
  };
}

export function RednoteNoteToUnifiedPost(note: any): UnifiedPost {
  return {
    id: note.post_id,
    platform: "rednote",
    author: note.username,
    authorId: note.user_id,
    avatarUrl: note.user_avatar_url,
    title: note.title,
    content: note.description,
    url: note.note_url,
    createdAt: note.created_at,
    likes: note.like_count,
    comments: note.comment_count || 0,
    shares: note.share_count,
    mediaUrls: note.image_urls || [],
    videoUrl: note.video_url,
    aiSummary: note.ai_summary,
    aiAnalysis: note.ai_analysis,
    aiTags: note.ai_tags || [],
    sentiment: mapSentiment(note.ai_sentiment),
    isMarketRelated: note.is_market_related,
    userLiked: note.user_liked,
    userFavorited: note.user_favorited,
    userTracked: note.user_tracked,
    totalLikes: note.total_likes,
    totalFavorites: note.total_favorites,
  };
}

// Conversion function for tracking API (unified social posts)
export function socialPostToUnifiedPost(post: any): UnifiedPost {
  const platformMap: { [key: string]: "x" | "reddit" | "youtube" | "rednote" } =
    {
      TWITTER: "x",
      REDDIT: "reddit",
      YOUTUBE: "youtube",
      REDNOTE: "rednote",
    };

  return {
    id: post.post_id,
    platform: platformMap[post.platform] || "x",
    author: post.creator_name,
    authorId: post.creator_id,
    avatarUrl: post.creator_avatar_url || "",
    // Creator info from creators table
    authorUsername: post.creator_username,
    authorVerified: post.creator_verified,
    authorBio: post.creator_bio,
    authorFollowersCount: post.creator_followers_count,
    authorCategory: post.creator_category,
    authorInfluenceScore: post.creator_influence_score,
    authorTrendingScore: post.creator_trending_score,
    content: post.content,
    url: post.content_url,
    createdAt: post.published_at,
    likes: post.likes_count || 0,
    comments: 0,
    mediaUrls: post.media_urls || [],
    aiSummary: post.ai_summary || "",
    aiAnalysis: post.ai_analysis || "",
    aiTags: post.ai_tags || [],
    aiAnalyzedAt: post.ai_analyzed_at,
    aiModel: post.ai_model,
    sentiment: mapSentiment(post.ai_sentiment || "neutral"),
    isMarketRelated: post.is_market_related ?? false,
    userLiked: post.user_liked,
    userFavorited: post.user_favorited,
    userTracked: post.user_tracked,
    totalLikes: post.total_likes,
    totalFavorites: post.total_favorites,
    favoriteId: post.favorite_id,
    likedAt: post.liked_at,
    favoritedAt: post.created_at, // Use the created_at from the join table
  };
}
