// Types for Trending Stocks components

export interface TopAuthor {
  username: string;
  displayName?: string;
  avatarUrl: string;
  tweetCount: number;
  sentiment?: string | null;
}

export interface TrendingStockDisplayItem {
  ticker: string;
  companyName?: string;
  mentionCount?: number;
  sentimentScore?: number;
  trendingScore?: number;
  uniqueAuthors?: number;
  logoUrl?: string | null;
  topAuthors?: TopAuthor[];
}

export type SortKey =
  | "ticker"
  | "mentionCount"
  | "uniqueAuthors"
  | "sentimentScore"
  | "trendingScore";

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

// Helper functions
export const getSentimentColor = (score?: number) => {
  if (!score) return "text-gray-900 dark:text-white";
  if (score > 50) return "text-green-500";
  if (score < -50) return "text-red-500";
  return "text-gray-900 dark:text-white";
};

export const getSentimentText = (score?: number) => {
  if (!score) return "Neutral";
  if (score > 50) return "Bullish";
  if (score < -50) return "Bearish";
  return "Neutral";
};

export const getSentimentRingColor = (sentiment?: string | null) => {
  if (!sentiment) return "ring-gray-300 dark:ring-gray-600";
  if (sentiment === "bullish") return "ring-green-400 dark:ring-green-500";
  if (sentiment === "bearish") return "ring-red-400 dark:ring-red-500";
  return "ring-gray-300 dark:ring-gray-600";
};
