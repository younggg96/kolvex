export type OpinionSentiment = "bullish" | "bearish" | "neutral" | "mixed";

export interface YouTubeOpinionSummary {
  total_opinions: number;
  total_stocks: number;
  total_creators: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_score: number;
  latest_opinion_at?: string | null;
}

export interface YouTubeStockSummary {
  ticker: string;
  company_name?: string | null;
  total_opinions: number;
  creator_count: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_score: number;
  avg_confidence?: number | null;
  latest_opinion_at?: string | null;
}

export interface YouTubeCreatorSummary {
  channel_id: string;
  channel_title?: string | null;
  channel_handle?: string | null;
  channel_avatar_url?: string | null;
  channel_url?: string | null;
  total_opinions: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_score: number;
  top_tickers: Array<{ ticker: string; count: number }>;
  latest_opinion_at?: string | null;
}

export interface YouTubeDailySummary {
  date: string;
  total: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_score: number;
}

export interface YouTubeDailyChange {
  ticker: string;
  current_date: string;
  current_score: number;
  previous_date?: string | null;
  previous_score?: number | null;
  change?: number | null;
  opinion_count: number;
}

export interface YouTubeOpinion {
  id: string;
  video_id: string;
  video_title?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  video_published_at?: string | null;
  channel_id: string;
  channel_title?: string | null;
  channel_handle?: string | null;
  channel_url?: string | null;
  channel_avatar_url?: string | null;
  ticker: string;
  company_name?: string | null;
  sentiment: OpinionSentiment;
  direction_score: number;
  confidence?: number | null;
  time_horizon?: string | null;
  thesis?: string | null;
  summary?: string | null;
  key_points?: string[];
  risks?: string[];
  price_targets?: unknown[];
  opinion_date: string;
  analyzed_at?: string | null;
  source_model?: string | null;
  created_at: string;
}

export interface YouTubeOpinionFilters {
  tickers: string[];
  creators: Array<{
    channel_id: string;
    channel_title?: string | null;
    channel_handle?: string | null;
    channel_avatar_url?: string | null;
  }>;
}

export interface YouTubeOpinionDashboard {
  summary: YouTubeOpinionSummary;
  stocks: YouTubeStockSummary[];
  creators: YouTubeCreatorSummary[];
  daily: YouTubeDailySummary[];
  changes: YouTubeDailyChange[];
  latest: YouTubeOpinion[];
  filters: YouTubeOpinionFilters;
}

export interface YouTubeOpinionDashboardParams {
  ticker?: string;
  channel_id?: string;
  sentiment?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

const API_PREFIX = "/api/youtube-opinions";

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_PREFIX}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.detail || `API error: ${response.status}`);
  }

  return data as T;
}

export async function getYouTubeOpinionDashboard(
  params: YouTubeOpinionDashboardParams = {}
): Promise<YouTubeOpinionDashboard> {
  const searchParams = new URLSearchParams();
  if (params.ticker) searchParams.set("ticker", params.ticker);
  if (params.channel_id) searchParams.set("channel_id", params.channel_id);
  if (params.sentiment) searchParams.set("sentiment", params.sentiment);
  if (params.date_from) searchParams.set("date_from", params.date_from);
  if (params.date_to) searchParams.set("date_to", params.date_to);
  if (params.limit) searchParams.set("limit", String(params.limit));

  const qs = searchParams.toString();
  return apiRequest<YouTubeOpinionDashboard>(`/dashboard${qs ? `?${qs}` : ""}`);
}

export async function uploadYouTubeOpinionPayload(
  payload: Record<string, unknown>
): Promise<{ success: boolean; inserted_count: number; video_id: string; tickers: string[] }> {
  return apiRequest("/upload", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface YouTubeImportPreview {
  video_id: string;
  video_title: string;
  channel_title: string;
  count: number;
  opinions: Pick<YouTubeOpinion, "ticker" | "sentiment" | "direction_score" | "confidence" | "summary" | "opinion_date">[];
}

export function validateYouTubeOpinionPayload(payload: Record<string, unknown>) {
  return apiRequest<YouTubeImportPreview>("/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
