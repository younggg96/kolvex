// Common types for all platform content components

import { SentimentAnalysis, TradingSignal } from "@/lib/kolTweetsApi";

export interface BaseContentProps {
  url: string;
  id: string;
  mediaUrls: string[];
  aiSummary?: string | null;
  aiTradingSignal?: TradingSignal | null;
  aiTags?: string[];
  aiModel?: string | null;
  aiAnalyzedAt?: string | null;
  sentiment?: SentimentAnalysis | null;
  onFormatText: (text: string) => React.ReactNode;
  likesCount?: number;
}
