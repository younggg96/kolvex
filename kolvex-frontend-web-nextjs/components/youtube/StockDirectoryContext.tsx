"use client";

import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { YouTubeStockSummary, YouTubeDailyChange } from "@/lib/youtubeOpinionsApi";
import OpinionChange from "./OpinionChange";

export default function StockDirectoryContext({ stock, change }: {
  stock: YouTubeStockSummary; change?: YouTubeDailyChange;
}) {
  const { t } = useTranslation();
  const distribution = stock.creator_distribution;
  const heat = stock.discussion_heat;
  const evidence = stock.latest_evidence;
  // Build source links from the canonical video id, never an arbitrary imported URL.
  const source = evidence?.video_id && /^[A-Za-z0-9_-]{11}$/.test(evidence.video_id)
    ? `https://www.youtube.com/watch?v=${evidence.video_id}` : undefined;
  const heatDelta = heat ? heat.recent - heat.previous : 0;
  return <div className="grid min-w-0 gap-3 pb-4 pt-1 text-xs lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
    <div className="min-w-0 space-y-2">
      <p className="text-muted-foreground">{t("youtubeOpinions.directory.distribution")}</p>
      {distribution?.total ? <>
        <div className="flex h-1.5 max-w-60 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {([[distribution.bullish, "bg-positive-fill"], [distribution.neutral, "bg-muted-foreground"], [distribution.bearish, "bg-negative-fill"]] as const).map(([count, fill], index) => <span key={index} className={fill} style={{ width: `${count / distribution.total * 100}%` }} />)}
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
          <span className="text-positive">{t("youtubeOpinions.bullish")} {distribution.bullish}</span>
          <span className="text-muted-foreground">{t("youtubeOpinions.directory.neutralMixed")} {distribution.neutral}</span>
          <span className="text-negative">{t("youtubeOpinions.bearish")} {distribution.bearish}</span>
        </p>
      </> : <p className="text-muted-foreground">{t("youtubeOpinions.directory.noRecentCreators")}</p>}
    </div>
    <div className="min-w-0 space-y-2">
      <OpinionChange value={change} />
      <p className="max-w-[40ch] text-[11px] leading-relaxed text-muted-foreground">{t("youtubeOpinions.directory.changeMethod")}</p>
      {heat && <p className="text-muted-foreground" title={t("youtubeOpinions.directory.heatMethod", { from: heat.from, to: heat.to, previous: String(heat.previous) })}>
        {t("youtubeOpinions.directory.heat", { count: String(heat.recent) })}
        <span className="ml-2">{t("youtubeOpinions.directory.heatDelta", { count: `${heatDelta > 0 ? "+" : ""}${heatDelta}` })}</span>
      </p>}
    </div>
    <div className="flex min-w-0 flex-col items-start gap-1 lg:items-end">
      <div className="flex flex-wrap items-center gap-1">
        {source && <Button asChild variant="ghost" size="xs"><a href={source} target="_blank" rel="noopener noreferrer">{t("youtubeOpinions.directory.source")}<ArrowUpRight className="ml-1 h-3 w-3" aria-hidden="true" /></a></Button>}
      </div>
    </div>
  </div>;
}
