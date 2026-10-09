export const TECHNICAL_CATEGORIES = [
  "trend", "momentum", "levels", "structure", "volume", "volatility",
  "waves", "moving_averages", "trendlines", "candlesticks", "fibonacci",
  "patterns", "timeframes", "score", "historical", "scenarios", "invalidation", "trade_plan", "breakouts", "retests", "false_breakouts",
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

export const DRAWING_CATEGORIES: TechnicalCategory[] = ["levels", "trendlines", "waves", "moving_averages", "patterns", "candlesticks", "fibonacci", "trade_plan", "breakouts", "retests", "false_breakouts"];
export const DEFAULT_DRAWING_FOCUS: TechnicalFocus = { categories: ["levels", "trendlines", "fibonacci", "trade_plan"], custom_scenarios: [] };
