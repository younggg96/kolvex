// KOL Analysis Types

import { KOLTweet } from "@/lib/kolTweetsApi";

export interface StockPrediction {
  ticker: string;
  sentiment: "bullish" | "bearish" | "neutral";
  tweetId: number;
  tweetText: string;
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
  tweets: KOLTweet[];
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

