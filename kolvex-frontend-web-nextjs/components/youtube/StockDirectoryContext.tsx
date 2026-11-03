"use client";

import { useTranslation } from "@/lib/i18n";
import type { YouTubeStockSummary, YouTubeDailyChange } from "@/lib/youtubeOpinionsApi";
import OpinionChange from "./OpinionChange";

export default function StockDirectoryContext({ stock, change }: {
  stock: YouTubeStockSummary; change?: YouTubeDailyChange;
}) {
  const { t } = useTranslation();
  const distribution = stock.creator_distribution;
  const heat = stock.discussion_heat;
  const heatDelta = heat ? heat.recent - heat.previous : 0;
  return <div className="grid min-w-0 gap-4 text-xs md:grid-cols-2">
    <section className="min-w-0 space-y-4 rounded-2xl bg-muted/50 p-4" aria-label={t("youtubeOpinions.directory.distribution")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("youtubeOpinions.directory.distributionTitle")}</h3>
        <span className="text-xs text-muted-foreground">{t("youtubeOpinions.directory.distributionWindow")}</span>
      </div>
      {distribution?.total ? <>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {([[distribution.bullish, "bg-positive-fill"], [distribution.neutral, "bg-muted-foreground"], [distribution.bearish, "bg-negative-fill"]] as const).map(([count, fill], index) => <span key={index} className={fill} style={{ width: `${count / distribution.total * 100}%` }} />)}
        </div>
        <p className="flex flex-wrap justify-between gap-x-4 gap-y-2 tabular-nums">
          <span className="inline-flex items-center gap-2 text-positive">{t("youtubeOpinions.bullish")} <strong className="text-sm font-semibold">{distribution.bullish}</strong></span>
          <span className="inline-flex items-center gap-2 text-muted-foreground">{t("youtubeOpinions.directory.neutralMixed")} <strong className="text-sm font-semibold text-foreground">{distribution.neutral}</strong></span>
          <span className="inline-flex items-center gap-2 text-negative">{t("youtubeOpinions.bearish")} <strong className="text-sm font-semibold">{distribution.bearish}</strong></span>
        </p>
      </> : <p className="text-muted-foreground">{t("youtubeOpinions.directory.noRecentCreators")}</p>}
    </section>
    <section className="min-w-0 space-y-3 rounded-2xl bg-muted/50 p-4" aria-label={t("youtubeOpinions.directory.changeTitle")}>
      <h3 className="text-sm font-semibold">{t("youtubeOpinions.directory.changeTitle")}</h3>
      <OpinionChange value={change} />
      {heat && <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 tabular-nums">
        <span>{t("youtubeOpinions.directory.heat", { count: String(heat.recent) })}</span>
        <span className="text-muted-foreground">{t("youtubeOpinions.directory.heatDelta", { count: `${heatDelta > 0 ? "+" : ""}${heatDelta}` })}</span>
      </p>}
      <details className="text-muted-foreground">
        <summary className="w-fit cursor-pointer rounded text-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("youtubeOpinions.directory.methodology")}</summary>
        <div className="mt-2 space-y-2 text-pretty leading-relaxed">
          <p>{t("youtubeOpinions.directory.changeMethod")}</p>
          {heat && <p>{t("youtubeOpinions.directory.heatMethod", { from: heat.from, to: heat.to, previous: String(heat.previous) })}</p>}
        </div>
      </details>
    </section>
  </div>;
}
