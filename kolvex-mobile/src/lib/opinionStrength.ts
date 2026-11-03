export type StrengthTone = "positive" | "negative" | "neutral";
// Whole phrases, so each one has its own entry in the English catalogue.
const labels = {
  bull: ["轻度看涨", "中度看涨", "强烈看涨"],
  bear: ["轻度看跌", "中度看跌", "强烈看跌"],
  rising: ["轻度转强", "中度转强", "强烈转强"],
  falling: ["轻度转弱", "中度转弱", "强烈转弱"],
};
/** Qualitative reading of a −100…+100 score; the number itself is never shown. */
export function describeStrength(
  value: number | null | undefined,
  change = false,
): { label: string; tone: StrengthTone; level: 0 | 1 | 2 | 3 } {
  if (typeof value !== "number" || !Number.isFinite(value))
    return { label: "暂无数据", tone: "neutral", level: 0 };
  if (value === 0)
    return { label: change ? "持平" : "中性", tone: "neutral", level: 0 };
  const magnitude = Math.min(Math.abs(value) / (change ? 200 : 100), 1);
  const level = (magnitude < 0.35 ? 1 : magnitude < 0.7 ? 2 : 3) as 1 | 2 | 3;
  const direction = change
    ? value > 0
      ? "rising"
      : "falling"
    : value > 0
      ? "bull"
      : "bear";
  return {
    label: labels[direction][level - 1],
    tone: value > 0 ? "positive" : "negative",
    level,
  };
}
