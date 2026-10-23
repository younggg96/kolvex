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
