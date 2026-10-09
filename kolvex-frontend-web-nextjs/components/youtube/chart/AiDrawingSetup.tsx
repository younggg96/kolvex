import { formatPrice, type AiTechnicalAnalysis } from "@/lib/stockApi";
import { cn } from "@/lib/utils";

type Translate = (key: string, params?: Record<string, string>) => string;

export default function AiDrawingSetup({ setup, t }: {
  setup: NonNullable<AiTechnicalAnalysis["setup"]>;
  t: Translate;
}) {
  const key = "youtubeOpinions.ai.tradePlan";
  return (
    <section className="mt-4 border-t border-border pt-4" aria-label={t(`${key}.title`)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="text-sm font-semibold">{setup.name}</h4>
        <span className={cn("text-xs font-medium", setup.direction === "bullish" ? "text-positive" : "text-negative")}>
          {t(`${key}.${setup.direction === "bullish" ? "long" : "short"}`)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {[
          ["entry", `${formatPrice(setup.entry_low)} – ${formatPrice(setup.entry_high)}`],
          ["stop", formatPrice(setup.invalidation)],
          ["target", setup.targets.map(formatPrice).join(" / ")],
          ["ratio", `${setup.risk_reward.toFixed(2)} : 1`],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{t(`${key}.${label}`)}</dt>
            <dd className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">{setup.reason}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(`${key}.basis`)}</p>
    </section>
  );
}
