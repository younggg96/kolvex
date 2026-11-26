// Research ratings (BUY / SELL / HOLD) and technical biases (bullish / bearish) are codes,
// not prose: they map to fixed labels and are never machine-translated (HOLD came back as
// 「抓住」). Same mapping as the Web's `decisionConfig` in components/trading-analysis/badges.tsx.
export type DecisionTone = "positive" | "negative" | "neutral";

export function decisionTone(value?: string | null): DecisionTone | null {
  if (!value) return null;
  const code = value.toUpperCase();
  if (code === "BUY" || code === "BULLISH") return "positive";
  if (code === "SELL" || code === "BEARISH") return "negative";
  return "neutral";
}

/** `bias` softens the label for a technical lean: 偏多 / 偏空 instead of 看多 / 看空. */
export function decisionLabel(value?: string | null, bias = false): string {
  const tone = decisionTone(value);
  if (tone === null) return "暂无结论";
  if (tone === "positive") return bias ? "偏多" : "看多";
  if (tone === "negative") return bias ? "偏空" : "看空";
  return "中性";
}
