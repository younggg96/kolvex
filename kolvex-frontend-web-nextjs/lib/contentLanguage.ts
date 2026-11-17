import type { Locale } from "@/lib/i18n";

/** Only tag Chinese prose here. Names, tickers and text in other scripts are left alone. */
export function chineseTextLanguage(text?: string | null): "zh-CN" | undefined {
  return text && /\p{Script=Han}/u.test(text) ? "zh-CN" : undefined;
}

/** Legacy technical snapshots may lack a saved request language. */
export function savedAnalysisLanguage(text: string, requested?: unknown): Locale | undefined {
  if (chineseTextLanguage(text)) return "zh";
  if (requested === "zh" || requested === "zh-CN") return "zh";
  if (requested === "en" || requested === "en-US" || /[A-Za-z]{3,}/.test(text)) return "en";
  return undefined;
}

const horizons = {
  short: ["短期", "short", "short term", "short-term"],
  medium: ["中期", "medium", "medium term", "medium-term", "mid-term"],
  long: ["长期", "long", "long term", "long-term"],
} as const;

export function opinionHorizonLabel(value: string, t: (key: string) => string): string {
  const normalized = value.trim().toLowerCase();
  for (const [horizon, aliases] of Object.entries(horizons)) {
    if (aliases.some((alias) => alias === normalized))
      return t(`youtubeOpinions.horizons.${horizon}`);
  }
  return value;
}
