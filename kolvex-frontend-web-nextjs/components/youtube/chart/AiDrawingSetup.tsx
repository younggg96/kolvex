import { formatPrice, type AiTechnicalAnalysis } from "@/lib/stockApi";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type Translate = (key: string, params?: Record<string, string>) => string;

export default function AiDrawingSetup({ setup, t }: {
  setup: NonNullable<AiTechnicalAnalysis["setup"]>;
  t: Translate;
}) {
  const key = "youtubeOpinions.ai.tradePlan";
  return (
    <section className="mt-4 border-t border-border pt-4" aria-label={t(`${key}.title`)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="break-words text-base font-semibold leading-6">{setup.name}</h4>
        <span className={cn("shrink-0 text-sm font-medium", setup.direction === "bullish" ? "text-positive" : "text-negative")}>
          {t(`${key}.${setup.direction === "bullish" ? "long" : "short"}`)}
        </span>
      </div>
      <dl className="mt-4 grid gap-4 rounded-xl bg-muted/60 p-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 7.5rem), 1fr))" }}>
        {[
          ["entry", `${formatPrice(setup.entry_low)} – ${formatPrice(setup.entry_high)}`],
          ["stop", formatPrice(setup.invalidation)],
          ["target", setup.targets.map(formatPrice).join(" / ")],
          ["ratio", `${setup.risk_reward.toFixed(2)} : 1`],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{t(`${key}.${label}`)}</dt>
            <dd className="mt-1 break-words text-base font-semibold leading-6 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{t(`${key}.basis`)}</p>
      <details className="group/plan mt-4 border-t border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-medium hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
          {t("youtubeOpinions.ai.planReason")}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground group-open/plan:rotate-180" aria-hidden="true" />
        </summary>
        <p className="max-w-[72ch] whitespace-pre-line break-words pb-3 text-sm leading-7 text-muted-foreground">{setup.reason}</p>
      </details>
    </section>
  );
}
