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

/** CNN's published score ranges for each rating, low to high. */
export const FEAR_GREED_BANDS = [
  { rating: "extreme fear", from: 0, to: 25 },
  { rating: "fear", from: 25, to: 45 },
  { rating: "neutral", from: 45, to: 55 },
  { rating: "greed", from: 55, to: 75 },
  { rating: "extreme greed", from: 75, to: 100 },
] as const satisfies readonly {
  rating: keyof typeof FEAR_GREED_RATINGS;
  from: number;
  to: number;
}[];

export function bandFor(score: number) {
  return FEAR_GREED_BANDS.find((band) => score < band.to) ?? FEAR_GREED_BANDS.at(-1)!;
}

function toDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day, time: Date.UTC(year, month - 1, day) };
}

function isoDate(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

/** Same day one calendar month earlier, clamped to that month's last day. */
function monthBefore(date: string): string {
  const { year, month, day } = toDate(date);
  const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  return isoDate(Date.UTC(year, month - 2, Math.min(day, lastDay)));
}

/** Observations from the month ending on the latest observation date. */
export function lastMonth(observations: FearGreedObservation[]): FearGreedObservation[] {
  const latest = observations.at(-1)?.date;
  if (!latest) return [];
  const start = monthBefore(latest);
  return observations.filter((point) => point.date >= start);
}
