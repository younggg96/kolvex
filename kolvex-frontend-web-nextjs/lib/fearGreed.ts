export const CNN_FEAR_GREED_URL = "https://www.cnn.com/markets/fear-and-greed";
export type FearGreedRating = "extreme fear" | "fear" | "neutral" | "greed" | "extreme greed";
export interface FearGreedSnapshot {
  score: number;
  rating: FearGreedRating;
  timestamp: string;
  previousClose: number | null;
  status: "ready" | "stale";
}

export function parseFearGreed(payload: unknown): FearGreedSnapshot {
  const point = (payload as { fear_and_greed?: Record<string, unknown> } | null)?.fear_and_greed;
  const validScore = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  const rating = typeof point?.rating === "string" ? point.rating.toLowerCase().trim() : "";
  if (!point || !validScore(point.score) || !["extreme fear", "fear", "neutral", "greed", "extreme greed"].includes(rating) || typeof point.timestamp !== "string" || !Number.isFinite(Date.parse(point.timestamp))) {
    throw new Error("Invalid CNN sentiment data");
  }
  return {
    score: point.score,
    rating: rating as FearGreedRating,
    timestamp: new Date(point.timestamp).toISOString(),
    previousClose: validScore(point.previous_close) ? point.previous_close : null,
    status: "ready",
  };
}
