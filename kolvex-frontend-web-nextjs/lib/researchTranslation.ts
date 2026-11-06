import type { ResearchTranslation, TradingAnalysis } from "./tradingAnalysisApi";

/** Research runs in English; other UI languages read a stored translation. */
export const RESEARCH_SOURCE_LANGUAGE = "en";

export function researchLanguage(locale: string): string {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

const TEXT_FIELDS = [
  "full_signal", "investment_plan", "trader_plan",
  "market_report", "fundamentals_report", "news_report", "sentiment_report",
] as const;

function filled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Overlay a translation field by field; anything untranslated keeps the original text. */
export function applyResearchTranslation<T extends Partial<TradingAnalysis>>(analysis: T, translation?: ResearchTranslation | null): T {
  if (!translation) return analysis;
  const out: Record<string, unknown> = { ...analysis };
  for (const field of TEXT_FIELDS) {
    if (filled(translation[field])) out[field] = translation[field];
  }
  for (const field of ["investment_debate", "risk_debate"] as const) {
    const original = analysis[field];
    const translated = translation[field];
    if (original && translated) {
      const merged: Record<string, unknown> = { ...original };
      for (const [key, value] of Object.entries(translated)) if (filled(value)) merged[key] = value;
      out[field] = merged;
    }
  }
  return out as T;
}

export function storedTranslation(analysis: Partial<TradingAnalysis> | null | undefined, language: string) {
  return analysis?.translations?.[language] || null;
}
