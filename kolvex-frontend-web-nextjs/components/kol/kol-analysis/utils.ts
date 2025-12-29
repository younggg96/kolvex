// KOL Analysis Utility Functions

import { StockPerformance, AnalysisStats } from "./types";

export function calculateStats(performances: StockPerformance[]): AnalysisStats {
  const evaluated = performances.filter((p) => p.isMatch !== null);
  const correct = evaluated.filter((p) => p.isMatch === true).length;
  const total = evaluated.length;
  const totalMentions = performances.reduce(
    (sum, p) => sum + p.predictions.length,
    0
  );
  const avgConfidence =
    performances.reduce((sum, p) => {
      const predConfidences = p.predictions
        .filter((pred) => pred.confidence !== null)
        .map((pred) => pred.confidence!);
      return (
        sum +
        (predConfidences.length > 0
          ? predConfidences.reduce((a, b) => a + b, 0) / predConfidences.length
          : 0)
      );
    }, 0) / (performances.length || 1);

  const bullishCount = performances.filter((p) => {
    const bullish = p.predictions.filter(
      (pred) => pred.sentiment === "bullish"
    ).length;
    const bearish = p.predictions.filter(
      (pred) => pred.sentiment === "bearish"
    ).length;
    return bullish > bearish;
  }).length;

  return {
    accuracy: total > 0 ? (correct / total) * 100 : null,
    correct,
    total,
    totalStocks: performances.length,
    totalMentions,
    avgConfidence: avgConfidence * 100,
    bullishRatio:
      performances.length > 0 ? (bullishCount / performances.length) * 100 : 0,
  };
}

export function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Today";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

