// ============================================================
// Helper Functions
// ============================================================

/**
 * 根据情感类型返回对应的环形边框颜色
 */
export const getSentimentRingColor = (sentiment?: string | null) => {
  if (!sentiment) return "ring-gray-300 dark:ring-gray-600";
  if (sentiment === "bullish") return "ring-green-400 dark:ring-green-500";
  if (sentiment === "bearish") return "ring-red-400 dark:ring-red-500";
  return "ring-gray-300 dark:ring-gray-600";
};

/**
 * 标准化 authors 数据格式
 * 兼容 camelCase 和 snake_case
 */
export function normalizeAuthors(
  authors: any[]
): {
  platform?: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  tweetCount: number;
  sentiment?: string | null;
}[] {
  return authors.map((a: any) => ({
    platform: a.platform,
    username: a.username,
    displayName: a.displayName ?? a.display_name ?? undefined,
    avatarUrl: a.avatarUrl ?? a.avatar_url ?? undefined,
    tweetCount: a.tweetCount ?? a.tweet_count ?? 0,
    sentiment: a.sentiment,
  }));
}

