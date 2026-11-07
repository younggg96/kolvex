"use client";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { finite } from "@/lib/stockFundamentals";
import { useCopy } from "./shared";

export function useFinancialFormat() {
  const { locale } = useTranslation();
  const intl = locale === "zh" ? "zh-CN" : "en-US";
  return {
    number: (value: unknown, compact = true) =>
      finite(value)
        ? new Intl.NumberFormat(intl, {
            notation: compact ? "compact" : "standard",
            maximumFractionDigits: 2,
          }).format(value)
        : "—",
    percent: (value: unknown) =>
      finite(value)
        ? new Intl.NumberFormat(intl, {
            style: "percent",
            maximumFractionDigits: 2,
          }).format(value)
        : "—",
    date: (value: string) =>
      Number.isFinite(Date.parse(value))
        ? new Date(value).toLocaleDateString(intl, {
            timeZone: "UTC",
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "—",
  };
}
export function FinancialState({
  loading,
  error,
  empty,
  retry,
  skeleton,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  retry: () => void;
  /** Placeholder in the shape of the content this state stands in for. */
  skeleton: React.ReactNode;
}) {
  const c = useCopy();
  if (loading)
    return (
      <div role="status">
        <span className="sr-only">
          {c("Loading financial data", "正在加载财务数据")}
        </span>
        <div aria-hidden="true">{skeleton}</div>
      </div>
    );
  if (error || empty)
    return (
      <div
        role={error ? "alert" : "status"}
        className="glass-card bg-card-glass rounded-3xl border border-foreground/10 px-6 py-12 text-center"
      >
        <p className="text-sm text-muted-foreground">
          {error
            ? c(
                "Financial data could not be loaded. Try again.",
                "财务数据加载失败，请重试。",
              )
            : c(
                "The source has no data for this stock and period.",
                "数据源暂未提供该股票在此周期的数据。",
              )}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={retry}>
          {c("Retry", "重试")}
        </Button>
      </div>
    );
  return null;
}
