// Tracked Stock types and API functions

export interface KOLOpinion {
  id: string;
  kolId: string;
  kolName: string;
  kolUsername: string;
  kolPlatform: string;
  kolAvatarUrl?: string;
  sentiment: "bullish" | "bearish" | "neutral";
  opinion: string;
  confidence?: number; // 1-10
  targetPrice?: number;
  timeframe?: string; // "short-term", "medium-term", "long-term"
  publishedAt: string;
  sourceUrl?: string;
}

export interface TrackedStock {
  id: string;
  symbol: string;
  companyName: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
  isTracking: boolean;
  addedAt: string;
  opinions: KOLOpinion[];
  logo?: string;
}

export interface CreateTrackedStockInput {
  symbol: string;
  companyName: string;
  logo?: string;
}

export interface UpdateTrackedStockInput {
  isTracking?: boolean;
}

// Sentiment colors and labels (matching home page design)
export const sentimentConfig = {
  bullish: {
    label: "Bullish",
    color: "text-green-500",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/40",
    dotColor: "bg-green-500",
  },
  bearish: {
    label: "Bearish",
    color: "text-red-500",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/40",
    dotColor: "bg-red-500",
  },
  neutral: {
    label: "Neutral",
    color: "text-gray-500",
    bgColor: "bg-gray-500/20",
    borderColor: "border-gray-500/40",
    dotColor: "bg-gray-500",
  },
} as const;

// API functions
export async function fetchTrackedStocks(): Promise<TrackedStock[]> {
  const response = await fetch("/api/tracked-stocks");
  if (!response.ok) {
    throw new Error("Failed to fetch tracked stocks");
  }
  return response.json();
}

export async function createTrackedStock(
  data: CreateTrackedStockInput
): Promise<TrackedStock> {
  const response = await fetch("/api/tracked-stocks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to create tracked stock");
  }
  return response.json();
}

export async function updateTrackedStock(
  id: string,
  data: UpdateTrackedStockInput
): Promise<TrackedStock> {
  const response = await fetch("/api/tracked-stocks", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, ...data }),
  });
  if (!response.ok) {
    throw new Error("Failed to update tracked stock");
  }
  return response.json();
}

export async function deleteTrackedStock(id: string): Promise<void> {
  const response = await fetch("/api/tracked-stocks", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw new Error("Failed to delete tracked stock");
  }
}

// Helper functions
export function getSentimentCounts(opinions: KOLOpinion[]) {
  return opinions.reduce(
    (acc, opinion) => {
      acc[opinion.sentiment] = (acc[opinion.sentiment] || 0) + 1;
      return acc;
    },
    { bullish: 0, bearish: 0, neutral: 0 } as Record<string, number>
  );
}

export function getOverallSentiment(
  opinions: KOLOpinion[]
): "bullish" | "bearish" | "neutral" {
  if (opinions.length === 0) return "neutral";

  const counts = getSentimentCounts(opinions);
  const max = Math.max(counts.bullish, counts.bearish, counts.neutral);

  if (counts.bullish === max) return "bullish";
  if (counts.bearish === max) return "bearish";
  return "neutral";
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatPercentage(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}
