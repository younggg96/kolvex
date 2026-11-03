"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ListRow } from "@/components/ui/list-card";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import type { YouTubeStockSummary, YouTubeDailyChange } from "@/lib/youtubeOpinionsApi";
import StockDirectoryContext from "./StockDirectoryContext";

/** The overview remains a link; disclosure and source actions are sibling controls. */
export default function StockDirectoryRow({ stock, children, performance, change }: {
  stock: YouTubeStockSummary;
  children: ReactNode;
  performance: ReactNode;
  change?: YouTubeDailyChange;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const evidence = stock.latest_evidence;
  const reason = evidence?.thesis || evidence?.summary || t("youtubeOpinions.directory.noReason");
  const source = evidence?.video_id && /^[A-Za-z0-9_-]{11}$/.test(evidence.video_id)
    ? `https://www.youtube.com/watch?v=${evidence.video_id}` : undefined;

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <ListRow className="min-w-0 flex-col items-stretch gap-0 rounded-2xl">
        {children}
        <div className="flex min-w-0 items-center gap-3 px-2 pb-2">
          {!open && <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{reason}</p>}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto shrink-0 cursor-pointer text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t(open ? "youtubeOpinions.directory.collapseAria" : "youtubeOpinions.directory.expandAria", { ticker: stock.ticker })}
            >
              {t(open ? "youtubeOpinions.directory.collapse" : "youtubeOpinions.directory.expand")}
              <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="space-y-4 px-2 pb-4 pt-2 sm:px-4">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
              <div className="min-w-0 py-2">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{t("youtubeOpinions.directory.latestReason")}</p>
                  {source && <Button asChild variant="outline" size="xs" className="cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"><a href={source} target="_blank" rel="noopener noreferrer">{t("youtubeOpinions.directory.source")}<ArrowUpRight className="h-3 w-3" aria-hidden="true" /></a></Button>}
                </div>
                <p className="whitespace-pre-line break-words text-pretty text-sm leading-relaxed">{reason}</p>
                {evidence && <p className="mt-3 break-words text-xs text-muted-foreground">
                  {evidence.channel_title || evidence.channel_id} · {formatOpinionDate(evidence.video_published_at || evidence.opinion_date, t("common.intlLocale"))}
                </p>}
              </div>
              <div className="min-h-40 min-w-0 rounded-2xl bg-muted/50 p-4">{performance}</div>
            </div>
            <StockDirectoryContext stock={stock} change={change} />
          </div>
        </CollapsibleContent>
      </ListRow>
    </Collapsible>
  );
}
