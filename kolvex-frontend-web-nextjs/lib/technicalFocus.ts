export const TECHNICAL_CATEGORIES = [
  "trend", "momentum", "levels", "structure", "volume", "volatility",
  "patterns", "timeframes", "score", "historical", "scenarios", "invalidation",
] as const;
export type TechnicalCategory = (typeof TECHNICAL_CATEGORIES)[number];
export interface TechnicalFocus {
  categories: TechnicalCategory[];
  custom_scenarios: string[];
}
export const DEFAULT_TECHNICAL_FOCUS: TechnicalFocus = {
  categories: ["trend", "momentum", "levels", "scenarios", "invalidation"],
  custom_scenarios: [],
};
