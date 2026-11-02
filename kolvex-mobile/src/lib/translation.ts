import messages from "./uiMessages.json";
import templates from "../../translations/templates-en.json";
export type UILocale = "zh" | "en";
const labels: Record<string, string> = messages;
export const normalizeLabel = (value: string) =>
  value.replace(/\s+/g, " ").trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(templates).map(([source, english]) => {
  const parts = source.split(/\{\d+\}/);
  return {
    pattern: new RegExp(`^${parts.map(escape).join("([\\s\\S]*?)")}$`),
    english,
  };
});
export function translate(value: string, locale: UILocale, depth = 0): string {
  if (locale !== "en") return value;
  const key = normalizeLabel(value);
  const unit = key.match(/^([+−-]?[0-9][0-9,.]*)\s*(个百分点|万人|点)$/);
  if (unit) {
    const amount = unit[1];
    return `${amount}${unit[2] === "个百分点" ? " pp" : unit[2] === "万人" ? " × 10,000 people" : " points"}`;
  }
  const label = labels[key];
  if (label) return value.replace(value.trim(), label);
  if (depth < 2) {
    for (const { pattern, english } of patterns) {
      const captures = key.match(pattern);
      if (captures)
        return english.replace(/\{(\d+)\}/g, (_, index) =>
          translate(captures[Number(index) + 1] || "", locale, depth + 1),
        );
    }
  }
  return value;
}
