export const FEAR_GREED_HISTORY_PATH = "/api/market/fear-greed";

export const FEAR_GREED_RATINGS = {
  "extreme fear": { en: "Extreme fear", zh: "极度恐慌" },
  fear: { en: "Fear", zh: "恐慌" },
  neutral: { en: "Neutral", zh: "中性" },
  greed: { en: "Greed", zh: "贪婪" },
  "extreme greed": { en: "Extreme greed", zh: "极度贪婪" },
} as const;

export interface FearGreedObservation {
  date: string;
  score: number;
  rating: keyof typeof FEAR_GREED_RATINGS | null;
}

export async function readFearGreed(signal: AbortSignal): Promise<FearGreedObservation[]> {
  const response = await fetch(FEAR_GREED_HISTORY_PATH, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Fear & Greed history unavailable");
  return response.json();
}
