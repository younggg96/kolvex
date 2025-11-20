import { TrendingTopic, Platform } from "./supabase/database.types";

export interface FetchTrendingTopicsParams {
  limit?: number;
  offset?: number;
  platform?: Platform;
  topicType?: string;
  sortBy?:
    | "trending_score"
    | "engagement_score"
    | "mention_count"
    | "last_seen_at";
  sortDirection?: "asc" | "desc";
}

export interface FetchTrendingTopicsResponse {
  topics: TrendingTopic[];
  count: number;
  total: number;
}

/**
 * Fetch trending topics from the API
 */
export async function fetchTrendingTopics(
  params: FetchTrendingTopicsParams = {}
): Promise<FetchTrendingTopicsResponse> {
  const {
    limit = 20,
    offset = 0,
    platform,
    topicType,
    sortBy = "trending_score",
    sortDirection = "desc",
  } = params;

  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    sort_by: sortBy,
    sort_direction: sortDirection,
  });

  if (platform) {
    searchParams.append("platform", platform);
  }

  if (topicType) {
    searchParams.append("topic_type", topicType);
  }

  const response = await fetch(
    `/api/trending-topics?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch trending topics");
  }

  return response.json();
}

/**
 * Get trending topics for a specific platform
 */
export async function getTrendingTopicsByPlatform(
  platform: Platform,
  limit: number = 20
): Promise<TrendingTopic[]> {
  const response = await fetchTrendingTopics({
    platform,
    limit,
    sortBy: "trending_score",
    sortDirection: "desc",
  });

  return response.topics;
}

/**
 * Get trending topics related to specific tickers
 */
export async function getTrendingTopicsByTickers(
  tickers: string[]
): Promise<TrendingTopic[]> {
  const response = await fetchTrendingTopics({
    limit: 100,
    sortBy: "trending_score",
    sortDirection: "desc",
  });

  // Filter topics that contain any of the tickers
  return response.topics.filter(
    (topic) =>
      topic.related_tickers &&
      topic.related_tickers.some((ticker) => tickers.includes(ticker))
  );
}

/**
 * Get the most trending topics across all platforms
 */
export async function getTopTrendingTopics(
  limit: number = 10
): Promise<TrendingTopic[]> {
  const response = await fetchTrendingTopics({
    limit,
    sortBy: "trending_score",
    sortDirection: "desc",
  });

  return response.topics;
}
