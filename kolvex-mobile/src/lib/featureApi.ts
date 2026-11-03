import { apiRequest } from "./http";
import type { Opinion, Dashboard } from "./models";
import type { XFeed } from "./contentTypes";
import type { CreatorLatestVideo } from "./creatorSharing";
export type Creator = {
  channel_id: string;
  channel_title?: string;
  channel_url?: string;
  description?: string;
  country?: string;
  subscriber_count?: number;
  video_count?: number;
  view_count?: number;
  hidden_subscriber_count?: boolean;
  total_opinions: number;
  avg_score: number;
  top_tickers: { ticker: string; count: number }[];
  profile_status?: string;
};
export type Change = {
  ticker: string;
  current_date: string;
  current_score: number;
  previous_date?: string;
  previous_score?: number;
  change?: number;
  opinion_count: number;
};
export type Catalogue = Dashboard & {
  creators: Creator[];
  stocks: {
    ticker: string;
    total_opinions: number;
    creator_count: number;
    avg_score: number;
  }[];
  changes: Change[];
  summary?: {
    total_opinions: number;
    bullish_count: number;
    bearish_count: number;
    neutral_count: number;
    avg_score: number;
  };
  daily?: { date: string; avg_score: number; total: number }[];
};
export type VideoGroup = {
  videoId: string;
  video: {
    video_title?: string;
    video_url?: string;
    video_published_at?: string;
  };
  creator?: { channel_id: string; channel_title?: string };
  video_summary?: string;
  opinions: Opinion[];
};
export type Indicator = {
  id: string;
  name_zh: string;
  name_en: string;
  unit: "percent" | "pp" | "thousands";
  change_unit: "bp" | "pp" | "thousands";
  frequency: string;
  status: string;
  value: number | null;
  change: number | null;
  period: string | null;
  source: string;
  source_url: string;
  history: { date: string; value: number }[];
};
export type Macro = {
  status: string;
  fetched_at: string | null;
  indicators: Indicator[];
};
export type Contract = {
  contract_symbol?: string;
  strike: number | null;
  last_price: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  open_interest: number | null;
  implied_volatility: number | null;
  in_the_money: boolean | null;
};
export type OptionChain = {
  expiration: string;
  calls: Contract[];
  puts: Contract[];
};
export const catalogue = (signal: AbortSignal, params = "") =>
  apiRequest<Catalogue>(`/youtube-opinions/dashboard?limit=20${params}`, {
    signal,
  });
export const creatorProfile = (id: string, signal: AbortSignal) =>
  apiRequest<Creator>(
    `/youtube-opinions/creators/${encodeURIComponent(id)}/profile`,
    { signal },
  );
export const videos = (page: number, signal: AbortSignal) =>
  apiRequest<{ videos: VideoGroup[]; pagination: { has_more: boolean } }>(
    `/youtube-opinions/videos?limit=20&offset=${(page - 1) * 20}`,
    { signal },
  );
export const xCreators = (signal: AbortSignal) =>
  apiRequest<{
    creators: {
      username: string;
      display_name: string;
      bio: string;
      website?: string;
      followers_count?: number;
    }[];
  }>("/x-content/creators", { signal });
export const authorPosts = (
  author: string,
  page: number,
  signal: AbortSignal,
) =>
  apiRequest<XFeed>(
    `/x-content/posts?author=${encodeURIComponent(author)}&limit=20&offset=${(page - 1) * 20}`,
    { signal },
  );
export const indicators = (user: string, signal: AbortSignal) =>
  apiRequest<Macro>("/market/indicators", {
    authenticated: true,
    expectedUser: user,
    signal,
  });
export const options = (symbol: string, signal: AbortSignal) =>
  apiRequest<{
    expirations: string[];
    options_chain: OptionChain | null;
    error?: string;
  }>(`/market/options/${encodeURIComponent(symbol)}`, { signal });
export const optionChain = (
  symbol: string,
  expiration: string,
  signal: AbortSignal,
) =>
  apiRequest<OptionChain>(
    `/market/options/${encodeURIComponent(symbol)}/${encodeURIComponent(expiration)}`,
    { signal },
  );
export const creatorLatestVideo = (id: string, signal: AbortSignal) =>
  apiRequest<CreatorLatestVideo>(
    `/youtube-opinions/creators/${encodeURIComponent(id)}/latest-video`,
    { signal },
  );
export function indicatorValue(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  const amount = unit === "thousands" ? value / 10 : value;
  return `${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}${unit === "thousands" ? " 万人" : unit === "percent" ? "%" : unit === "bp" ? " bp" : " 个百分点"}`;
}
