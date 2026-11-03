// Same output as the Web's useFinancialFormat. Hermes' Intl differs by platform for
// compact notation and time zones, so the wording is computed instead of delegated.
import { finite } from "./stockResearch";
export type FormatLocale = "zh" | "en";
const steps = {
  en: [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ],
  zh: [
    [1e12, "万亿"],
    [1e8, "亿"],
    [1e4, "万"],
  ],
} as const;
const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const grouped = (value: number, locale: FormatLocale) =>
  value.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 2,
  });
export function compactNumber(value: number, locale: FormatLocale): string {
  const size = Math.abs(value);
  const list = steps[locale];
  // A value that rounds up to the next unit reads in that unit: 999,999 is 1M.
  for (let i = 0; i < list.length; i++) {
    const [unit, label] = list[i];
    if (size < unit) continue;
    const scaled = round2(size / unit);
    if (i > 0 && scaled >= list[i - 1][0] / unit)
      return `${value < 0 ? "-" : ""}1${list[i - 1][1]}`;
    return `${value < 0 ? "-" : ""}${scaled}${label}`;
  }
  const smallest = list[list.length - 1];
  const rounded = round2(size);
  if (rounded >= smallest[0]) return `${value < 0 ? "-" : ""}1${smallest[1]}`;
  // Compact notation leaves the digits under the first unit ungrouped.
  return `${value < 0 ? "-" : ""}${rounded}`;
}
const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
export function financialFormat(locale: FormatLocale) {
  return {
    number: (value: unknown, compact = true) =>
      finite(value)
        ? compact
          ? compactNumber(value, locale)
          : grouped(value, locale)
        : "—",
    percent: (value: unknown) =>
      finite(value) ? `${grouped(round2(value * 100), locale)}%` : "—",
    date: (value: string) => {
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime())) return "—";
      const [year, month, day] = [
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ];
      return locale === "zh"
        ? `${year}年${month + 1}月${day}日`
        : `${months[month]} ${day}, ${year}`;
    },
  };
}
