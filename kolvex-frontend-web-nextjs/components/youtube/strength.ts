export type StrengthTone = "positive" | "negative" | "neutral";

export interface StrengthDescription {
  label: string;
  tone: StrengthTone;
  /** 0 = none or neutral, 1 mild, 2 moderate, 3 strong */
  level: 0 | 1 | 2 | 3;
  available: boolean;
}

type Translate = (key: string, params?: Record<string, string>) => string;

/** Qualitative reading of a −100…+100 score; the number itself is never shown. */
export function describeStrength(
  value: number | null | undefined,
  { t, change = false }: { t: Translate; change?: boolean },
): StrengthDescription {
  const available = typeof value === "number" && Number.isFinite(value);
  const score = available ? (value as number) : 0;
  if (!available) {
    return { label: t("youtubeOpinions.strength.noData"), tone: "neutral", level: 0, available };
  }
  if (score === 0) {
    return {
      label: change ? t("youtubeOpinions.strength.unchanged") : t("youtubeOpinions.neutral"),
      tone: "neutral",
      level: 0,
      available,
    };
  }
  const magnitude = Math.min(Math.abs(score) / (change ? 200 : 100), 1);
  const level = (magnitude < 0.35 ? 1 : magnitude < 0.7 ? 2 : 3) as 1 | 2 | 3;
  const levelKey = (["", "mild", "moderate", "strong"] as const)[level];
  const directionKey = change
    ? score > 0 ? "strengthening" : "weakening"
    : score > 0 ? "bullish" : "bearish";
  return {
    label: t("youtubeOpinions.strength.label", {
      level: t(`youtubeOpinions.strength.${levelKey}`),
      direction: t(`youtubeOpinions.strength.${directionKey}`),
    }),
    tone: score > 0 ? "positive" : "negative",
    level,
    available,
  };
}

export const toneText: Record<StrengthTone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-foreground/75",
};

export const toneFill: Record<StrengthTone, string> = {
  positive: "bg-positive-fill",
  negative: "bg-negative-fill",
  neutral: "bg-muted-foreground",
};

export const toneStroke: Record<StrengthTone, string> = {
  positive: "rgb(var(--positive-fill))",
  negative: "rgb(var(--negative-fill))",
  neutral: "rgb(var(--muted-foreground))",
};
