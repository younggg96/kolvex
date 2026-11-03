// Copied from the Web's lib/economicIndicators.ts; a test keeps these in step.
export interface EconomicIndicator {
  frequency: "daily" | "monthly" | "quarterly";
  unit: "percent" | "pp" | "thousands";
  change_unit: "bp" | "pp" | "thousands";
}
export function indicatorPeriod(
  indicator: Pick<EconomicIndicator, "frequency">,
  period: string | null,
  locale: string,
): string {
  if (!period) return "—";
  if (indicator.frequency === "quarterly")
    return `${period.slice(0, 4)} Q${Math.ceil(Number(period.slice(5, 7)) / 3)}`;
  if (indicator.frequency === "monthly")
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${period}T00:00:00Z`));
  return period;
}

export function indicatorValue(
  value: number | null,
  unit: EconomicIndicator["unit"] | EconomicIndicator["change_unit"],
  locale: string,
  signed = false,
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const zh = locale.startsWith("zh");
  const amount = unit === "thousands" && zh ? value / 10 : value;
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: unit === "thousands" ? (zh ? 1 : 0) : 2,
    maximumFractionDigits: unit === "thousands" ? 1 : 2,
  }).format(Math.abs(amount));
  const prefix = amount < 0 ? "−" : signed && amount > 0 ? "+" : "";
  const suffix =
    unit === "thousands"
      ? zh
        ? " 万人"
        : "K"
      : unit === "percent"
        ? "%"
        : unit === "bp"
          ? " bp"
          : zh
            ? " 个百分点"
            : " pp";
  return `${prefix}${text}${suffix}`;
}
