"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDateShort } from "@/lib/opinionDates";
import type { YouTubeStockSummary } from "@/lib/youtubeOpinionsApi";
import { toneFill } from "./strength";

/**
 * Second line of a stock directory row, rendered inside the row link so the
 * whole row stays one target with one hover surface. It subgrids the row:
 * the latest take fills the leading columns and the creator split sits under
 * the consensus column. Full evidence lives on the stock page the row opens.
 */
export default function StockDirectoryInsight({ stock, narrow = false }: {
  stock: YouTubeStockSummary;
  narrow?: boolean;
}) {
  const { t } = useTranslation();
  const evidence = stock.latest_evidence;
  const reason = evidence?.thesis || evidence?.summary;
  const author = evidence ? evidence.channel_title || evidence.channel_id : undefined;
  const date = evidence ? formatOpinionDateShort(evidence.video_published_at || evidence.opinion_date, t("common.intlLocale")) : undefined;
  const split = stock.creator_distribution;
  const segments = split?.total ? [
    { key: "bullish", label: t("youtubeOpinions.bullish"), count: split.bullish, fill: toneFill.positive },
    { key: "neutral", label: t("youtubeOpinions.directory.neutralMixed"), count: split.neutral, fill: "bg-foreground/25" },
    { key: "bearish", label: t("youtubeOpinions.bearish"), count: split.bearish, fill: toneFill.negative },
  ] : [];
  const splitLabel = segments.map(segment => `${segment.label} ${segment.count}`).join(" · ");

  // Phones: the row already shows the verdict; the latest take and the split open on the stock page.
  return (
    <div className="col-span-full grid min-w-0 grid-cols-subgrid items-center max-sm:hidden">
      <p className={cn("min-w-0 truncate text-[0.8125rem] leading-5 text-muted-foreground", !narrow && "sm:col-span-2")}>
        {reason ? <>
          {author && <span className="font-medium text-foreground/80">{author}</span>}
          {date && <span className="tabular-nums"> · {date}</span>}
          {author && <span aria-hidden="true">　</span>}
          {reason}
        </> : t("youtubeOpinions.directory.noReason")}
      </p>
      {segments.length > 0 ? (
        <div className="w-24 justify-self-end sm:w-full" title={`${t("youtubeOpinions.directory.distributionWindow")} · ${splitLabel}`}>
          <span className="sr-only">{t("youtubeOpinions.directory.distributionTitle")}: {splitLabel}</span>
          <div aria-hidden="true" className="flex h-1 gap-0.5 overflow-hidden rounded-full">
            {segments.filter(segment => segment.count > 0).map(segment => (
              <span key={segment.key} className={cn("h-full rounded-full", segment.fill)} style={{ flexGrow: segment.count, flexBasis: 0 }} />
            ))}
          </div>
          <div aria-hidden="true" className="mt-1.5 flex justify-between text-[0.6875rem] leading-none tabular-nums text-muted-foreground">
            {segments.map(segment => (
              <span key={segment.key} className="inline-flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 rounded-full", segment.fill)} />
                {segment.count}
              </span>
            ))}
          </div>
        </div>
      ) : <span aria-hidden="true" />}
    </div>
  );
}
