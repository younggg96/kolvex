import type { ScrubPoint } from "@/components/decision/ScrubChart";

export interface EconomicIndicator {
  id: string;
  name_en: string;
  name_zh: string;
  group: "rates" | "inflation" | "employment" | "growth";
  frequency: "daily" | "monthly" | "quarterly";
  unit: "percent" | "pp" | "thousands";
  change_unit: "bp" | "pp" | "thousands";
  source: string;
  source_url: string;
  series_id: string;
  method: "level" | "spread" | "yoy" | "monthly_change";
  status: "ready" | "stale" | "unavailable";
  value: number | null;
  period: string | null;
  previous_value: number | null;
  previous_period: string | null;
  change: number | null;
  history: ScrubPoint[];
}

export interface EconomicSnapshot {
  status: "ready" | "partial" | "stale" | "unavailable" | "pending";
  fetched_at: string | null;
  refresh_hours: number;
  indicators: EconomicIndicator[];
}

export const MACRO_RANGES = [
  { value: "1D", zh: "1日", en: "1 day" },
  { value: "1W", zh: "1周", en: "1 week" },
  { value: "1M", zh: "1月", en: "1 month" },
  { value: "1Y", zh: "1年", en: "1 year" },
  { value: "3Y", zh: "3年", en: "3 years" },
  { value: "5Y", zh: "5年", en: "5 years" },
] as const;

export type MacroRange = typeof MACRO_RANGES[number]["value"];

export function macroHistory(history: ScrubPoint[], frequency: EconomicIndicator["frequency"], range: MacroRange) {
  const latest = history.at(-1);
  if (!latest) return [];
  // Daily sources have no intraday observations. Compare the latest two
  // available observations, including across weekends and market holidays.
  if (range === "1D") return history.slice(frequency === "daily" ? -2 : -1);
  const cutoff = new Date(latest.date);
  if (range === "1W") {
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  } else {
    const day = cutoff.getUTCDate();
    cutoff.setUTCDate(1);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - ({ "1M": 1, "1Y": 12, "3Y": 36, "5Y": 60 }[range]));
    const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
    cutoff.setUTCDate(Math.min(day, lastDay));
  }
  const start = cutoff.toISOString().slice(0, 10);
  return history.filter((point) => point.date >= start);
}

export class EconomicRequestError extends Error {
  constructor(public readonly status: number) { super("Economic indicators unavailable"); }
}

export async function getEconomicIndicators(signal: AbortSignal): Promise<EconomicSnapshot> {
  const response = await fetch("/api/market/indicators", { cache: "no-store", signal });
  if (!response.ok) throw new EconomicRequestError(response.status);
  const data = await response.json();
  if (!data || !Array.isArray(data.indicators)) throw new EconomicRequestError(502);
  return data;
}

export function indicatorPeriod(indicator: Pick<EconomicIndicator, "frequency">, period: string | null, locale: string): string {
  if (!period) return "—";
  if (indicator.frequency === "quarterly") return `${period.slice(0, 4)} Q${Math.ceil(Number(period.slice(5, 7)) / 3)}`;
  if (indicator.frequency === "monthly") return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${period}T00:00:00Z`));
  return period;
}

export function indicatorValue(value: number | null, unit: EconomicIndicator["unit"] | EconomicIndicator["change_unit"], locale: string, signed = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const zh = locale.startsWith("zh");
  const amount = unit === "thousands" && zh ? value / 10 : value;
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: unit === "thousands" ? (zh ? 1 : 0) : 2,
    maximumFractionDigits: unit === "thousands" ? 1 : 2,
  }).format(Math.abs(amount));
  const prefix = amount < 0 ? "−" : signed && amount > 0 ? "+" : "";
  const suffix = unit === "thousands" ? zh ? " 万人" : "K" : unit === "percent" ? "%" : unit === "bp" ? " bp" : zh ? " 个百分点" : " pp";
  return `${prefix}${text}${suffix}`;
}
