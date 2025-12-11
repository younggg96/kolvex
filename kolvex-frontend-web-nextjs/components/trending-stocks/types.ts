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
  price?: number;
  changePercent?: number;
  logoUrl?: string | null;
  topAuthors?: TopAuthor[];
}

export interface TrendingStocksListProps {
  stocks?: TrendingStockDisplayItem[];
  fetchFromApi?: boolean;
  loading?: boolean;
  showMetrics?: boolean;
  enableInfiniteScroll?: boolean;
  maxHeight?: string;
  onAddClick?: () => void;
  withCard?: boolean;
  trackedStocksMap?: Map<string, string>;
  onTrackedStocksChange?: () => void;
}

export type SortKey =
  | "ticker"
  | "price"
  | "changePercent"
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

export const getPriceChangeColor = (change?: number) => {
  if (!change) return "text-gray-500";
  return change >= 0 ? "text-green-500" : "text-red-500";
};

export const getSentimentRingColor = (sentiment?: string | null) => {
  if (!sentiment) return "ring-gray-300 dark:ring-gray-600";
  if (sentiment === "bullish") return "ring-green-400 dark:ring-green-500";
  if (sentiment === "bearish") return "ring-red-400 dark:ring-red-500";
  return "ring-gray-300 dark:ring-gray-600";
};

