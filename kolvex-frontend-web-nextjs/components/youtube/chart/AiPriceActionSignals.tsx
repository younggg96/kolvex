import { formatPrice, type AiTechnicalAnalysis } from "@/lib/stockApi";
import { cn } from "@/lib/utils";

const categories = new Set(["breakouts", "retests", "false_breakouts"]);

export default function AiPriceActionSignals({ result, formatDate, t }: {
  result: AiTechnicalAnalysis;
  formatDate: (date: string) => string;
  t: (key: string) => string;
}) {
  const signals = (result.overlays ?? [])
    .filter(item => categories.has(item.category) && item.detected_at && typeof item.level === "number")
    .sort((a, b) => Date.parse(b.detected_at!) - Date.parse(a.detected_at!));
  if (!signals.length) return null;

  return (
    <section className="mt-4 border-t border-border pt-4" aria-label={t("youtubeOpinions.ai.priceAction.title")}>
      <h4 className="text-sm font-semibold">{t("youtubeOpinions.ai.priceAction.title")}</h4>
      <ul className="mt-2 divide-y divide-border">
        {signals.map((signal, index) => (
          <li key={`${signal.category}-${signal.detected_at}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span className={cn("text-sm font-medium", signal.status !== "confirmed" ? "text-muted-foreground" : signal.direction === "bullish" ? "text-positive" : signal.direction === "bearish" ? "text-negative" : "text-foreground")}>
              {signal.label}
            </span>
            <span className="flex shrink-0 gap-3 text-xs tabular-nums text-muted-foreground">
              <time dateTime={signal.detected_at}>{formatDate(signal.detected_at!)}</time>
              <span>{formatPrice(signal.level!)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 max-w-prose text-xs leading-5 text-muted-foreground">{t("youtubeOpinions.ai.priceAction.rules")}</p>
    </section>
  );
}
