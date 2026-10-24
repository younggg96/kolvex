"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import type { YouTubeStockSummary, YouTubeDailyChange } from "@/lib/youtubeOpinionsApi";
import StockDirectoryContext from "./StockDirectoryContext";

/** The overview remains a link; disclosure and source/watch actions are sibling controls. */
export default function StockDirectoryRow({ stock, children, performance, change, watched, watchReady, onWatch }: {
  stock: YouTubeStockSummary;
  children: ReactNode;
  performance: ReactNode;
  change?: YouTubeDailyChange;
  watched: boolean;
  watchReady: boolean;
  onWatch: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const evidence = stock.latest_evidence;
  const reason = evidence?.thesis || evidence?.summary || t("youtubeOpinions.directory.noReason");

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <article className="min-w-0 border-b border-border/70 pb-2 last:border-0">
        {children}
        <div className="flex min-w-0 items-center gap-3 pb-1">
          {!open && <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{reason}</p>}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={t(open ? "youtubeOpinions.directory.collapseAria" : "youtubeOpinions.directory.expandAria", { ticker: stock.ticker })}
            >
              {t(open ? "youtubeOpinions.directory.collapse" : "youtubeOpinions.directory.expand")}
              <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="space-y-4 border-t border-border/50 pb-2 pt-4">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("youtubeOpinions.directory.latestReason")}</p>
                <p className="max-w-[72ch] whitespace-pre-line break-words text-[13px] leading-relaxed">{reason}</p>
                {evidence && <p className="mt-2 text-xs text-muted-foreground">
                  {evidence.channel_title || evidence.channel_id} · {formatOpinionDate(evidence.video_published_at || evidence.opinion_date, t("common.intlLocale"))}
                </p>}
              </div>
              {performance}
            </div>
            <StockDirectoryContext stock={stock} change={change} watched={watched} watchReady={watchReady} onWatch={onWatch} />
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}
