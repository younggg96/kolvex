"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CompanyLogo from "@/components/ui/company-logo";
import { PendingValue } from "@/components/ui/content-loading";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDateShort } from "@/lib/opinionDates";
import { getYouTubeStockDetail, type OpinionSentiment, type YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import { cn } from "@/lib/utils";
import { Change, money, useCopy } from "./shared";

const MAX_CALLS = 5;

/** Each creator's newest call on the ticker, newest first. */
function latestCalls(opinions: YouTubeOpinion[]) {
  const when = (opinion: YouTubeOpinion) => opinion.video_published_at || opinion.opinion_date || "";
  const byCreator = new Map<string, YouTubeOpinion>();
  for (const opinion of [...opinions].sort((a, b) => when(b).localeCompare(when(a)))) {
    if (!byCreator.has(opinion.channel_id)) byCreator.set(opinion.channel_id, opinion);
  }
  return [...byCreator.values()].slice(0, MAX_CALLS);
}

/** Phone-only stock preview for a Watchlist row: company, quote and recent creator calls. */
export default function WatchlistStockSheet({ open, symbol, name, price, changePercent, href, onClose }: {
  open: boolean;
  /** Kept after closing so the content stays put while the sheet animates out. */
  symbol: string | null;
  name?: string | null;
  price?: number;
  changePercent?: number;
  href: string;
  onClose: () => void;
}) {
  return <Dialog open={open && Boolean(symbol)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent layout="sheet" className="flex flex-col">
      {symbol && <SheetBody symbol={symbol} name={name} price={price} changePercent={changePercent} href={href} />}
    </DialogContent>
  </Dialog>;
}

function SheetBody({ symbol, name, price, changePercent, href }: {
  symbol: string; name?: string | null; price?: number; changePercent?: number; href: string;
}) {
  const c = useCopy();
  const { t } = useTranslation();
  const detail = useCachedResource(
    `/api/youtube-opinions/stocks/${encodeURIComponent(symbol)}`,
    signal => getYouTubeStockDetail(symbol, {}, signal),
    { ttl: 60_000 },
  );
  const calls = useMemo(() => latestCalls(detail.data?.opinions ?? []), [detail.data]);
  const sentiment: Record<OpinionSentiment, { label: string; className: string }> = {
    bullish: { label: t("youtubeOpinions.bullish"), className: "text-positive" },
    bearish: { label: t("youtubeOpinions.bearish"), className: "text-negative" },
    neutral: { label: t("youtubeOpinions.neutral"), className: "text-muted-foreground" },
    mixed: { label: c("Mixed", "分歧"), className: "text-muted-foreground" },
  };

  return <>
    <DialogHeader className="pr-12 text-left">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="shrink-0"><CompanyLogo symbol={symbol} size="sm" /></span>
        <div className="min-w-0">
          <DialogTitle className="text-lg">{symbol}</DialogTitle>
          <DialogDescription className="truncate">{name || symbol}</DialogDescription>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <span className="figure block text-base font-medium">{money(price)}</span>
          <Change value={changePercent} className="mt-0.5 block text-xs font-semibold" />
        </div>
      </div>
    </DialogHeader>

    <section aria-labelledby="watchlist-sheet-calls" className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <h3 id="watchlist-sheet-calls" className="mb-2 text-xs font-medium text-muted-foreground">{c("Recent creator calls", "最近博主观点")}</h3>
      {detail.loading && !detail.data ? <PendingValue className="h-24" />
        : !calls.length ? <p className="py-4 text-sm text-muted-foreground">{detail.error ? c("Creator calls are unavailable right now.", "博主观点暂时无法加载。") : c("No creator calls yet.", "暂无博主观点。")}</p>
          : <ul className="divide-y divide-border">
            {calls.map(call => {
              const tone = sentiment[call.sentiment] ?? sentiment.neutral;
              const date = formatOpinionDateShort(call.video_published_at || call.opinion_date, t("common.intlLocale"));
              const reason = call.thesis || call.summary;
              return <li key={call.id} className="py-3">
                <p className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{call.channel_title || call.channel_handle || call.channel_id}</span>
                  {date && <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{date}</span>}
                  <span className={cn("ml-auto shrink-0 text-xs font-semibold", tone.className)}>{tone.label}</span>
                </p>
                {reason && <p className="mt-1 line-clamp-3 text-[0.8125rem] leading-5 text-muted-foreground">{reason}</p>}
              </li>;
            })}
          </ul>}
    </section>

    <Button asChild className="mt-4 shrink-0 gap-2"><Link href={href}>{c("Open stock page", "查看个股详情")}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
  </>;
}
