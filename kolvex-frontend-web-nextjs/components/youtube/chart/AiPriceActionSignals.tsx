import { formatPrice, type AiTechnicalAnalysis } from "@/lib/stockApi";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

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
      <details className="group/rules mt-2">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
          {t("youtubeOpinions.ai.signalRules")}
          <ChevronDown className="h-3.5 w-3.5 group-open/rules:rotate-180" aria-hidden="true" />
        </summary>
        <p className="max-w-[72ch] pb-2 text-sm leading-6 text-muted-foreground">{t("youtubeOpinions.ai.priceAction.rules")}</p>
      </details>
    </section>
  );
}
