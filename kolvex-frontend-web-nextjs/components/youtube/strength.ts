export type StrengthTone = "positive" | "negative" | "neutral";

export interface StrengthDescription {
  label: string;
  tone: StrengthTone;
  /** 0 = none or neutral, 1 mild, 2 moderate, 3 strong */
  level: 0 | 1 | 2 | 3;
  available: boolean;
}

/** Qualitative reading of a −100…+100 score; the number itself is never shown. */
export function describeStrength(
  value: number | null | undefined,
  { zh, change = false }: { zh: boolean; change?: boolean },
): StrengthDescription {
  const available = typeof value === "number" && Number.isFinite(value);
  const score = available ? (value as number) : 0;
  if (!available) {
    return { label: zh ? "暂无数据" : "No data", tone: "neutral", level: 0, available };
  }
  if (score === 0) {
    return {
      label: change ? (zh ? "持平" : "Unchanged") : zh ? "中性" : "Neutral",
      tone: "neutral",
      level: 0,
      available,
    };
  }
  const magnitude = Math.min(Math.abs(score) / (change ? 200 : 100), 1);
  const level = magnitude < 0.35 ? 1 : magnitude < 0.7 ? 2 : 3;
  const levelLabel = zh
    ? ["", "轻度", "中度", "强烈"][level]
    : ["", "Mildly", "Moderately", "Strongly"][level];
  const direction = change
    ? score > 0
      ? zh ? "转强" : "strengthening"
      : zh ? "转弱" : "weakening"
    : score > 0
      ? zh ? "看涨" : "bullish"
      : zh ? "看跌" : "bearish";
  return {
    label: zh ? `${levelLabel}${direction}` : `${levelLabel} ${direction}`,
    tone: score > 0 ? "positive" : "negative",
    level: level as 1 | 2 | 3,
    available,
  };
}

export const toneText: Record<StrengthTone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-muted-foreground",
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
