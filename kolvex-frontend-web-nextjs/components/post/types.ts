// Common types for all platform content components

import { MediaItem, SentimentAnalysis, TradingSignal } from "@/lib/kolPostsApi";

export interface BaseContentProps {
  url: string;
  id: string;
  mediaItems: MediaItem[];
  aiSummary?: string | null;
  aiTradingSignal?: TradingSignal | null;
  aiTags?: string[];
  aiModel?: string | null;
  aiAnalyzedAt?: string | null;
  sentiment?: SentimentAnalysis | null;
  onFormatText: (text: string) => React.ReactNode;
  likesCount?: number;
}
