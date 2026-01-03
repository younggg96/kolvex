// KOL Analysis Types

import { KOLPost } from "@/lib/kolPostsApi";

export interface StockPrediction {
  ticker: string;
  sentiment: "bullish" | "bearish" | "neutral";
  postId: number;
  postContent: string;
  predictedAt: string;
  confidence: number | null;
}

export interface StockPerformance {
  ticker: string;
  predictions: StockPrediction[];
  currentPrice?: number;
  priceChange7d?: number;
  priceChange30d?: number;
  isMatch?: boolean | null;
}

export interface KOLAnalysisPanelProps {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  posts: KOLPost[];
  isLoading?: boolean;
}

export interface AnalysisStats {
  accuracy: number | null;
  correct: number;
  total: number;
  totalStocks: number;
  totalMentions: number;
  avgConfidence: number;
  bullishRatio: number;
}
