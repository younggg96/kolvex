import Link from "next/link";
import { ChevronRight } from "lucide-react";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import CompanyLogo from "@/components/ui/company-logo";
import {
  ListCard,
  ListColumnHeader,
  ListRow,
  ListRows,
  listRowTargetClass,
} from "@/components/ui/list-card";
import { creatorSharePath } from "@/lib/creatorSharing";
import { publicStockPath } from "@/lib/publicRoutes";
import { marketStockUrl } from "@/lib/stockLinks";
import type { YouTubeCreatorSummary, YouTubeStockSummary } from "@/lib/youtubeOpinionsApi";
import { cn } from "@/lib/utils";
import { ReadingDate } from "./ReadingElements";

/** Directory rows read as one list card: logo/avatar, name, trailing date and disclosure. */
const rowTargetClass = cn("group flex min-w-0 items-center gap-3", listRowTargetClass);
const trailingDateClass = "hidden w-[9.5rem] shrink-0 whitespace-nowrap text-right text-xs text-muted-foreground sm:block";

function DirectoryHeader({ lead, trail }: { lead: string; trail: string }) {
  return (
    <ListColumnHeader>
      <div className="flex w-full items-center gap-3 px-2 py-3">
        <span className="min-w-0 flex-1">{lead}</span>
        <span className="hidden w-[9.5rem] shrink-0 whitespace-nowrap text-right sm:block">{trail}</span>
        <span className="hidden w-4 shrink-0 sm:block" aria-hidden="true" />
      </div>
    </ListColumnHeader>
  );
}

export function CreatorDirectory({ creators }: { creators: YouTubeCreatorSummary[] }) {
  if (!creators.length) return null;
  return (
    <ListCard>
      <DirectoryHeader lead="博主" trail="最近观点" />
      <ListRows aria-label="已收录博主">
        {creators.map((creator) => {
          const name = creator.channel_title || creator.channel_handle || "财经博主";
          return <ListRow key={creator.channel_id} data-reading-reveal data-reading-item="row">
            <Link href={creatorSharePath(creator.channel_id)} className={rowTargetClass}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <CreatorAvatar name={name} avatarUrl={creator.channel_avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-[15px] font-semibold">{name}</h2>
                  <p className="mt-1 break-words text-xs leading-6 text-muted-foreground">关注股票：{creator.top_tickers.map((stock) => stock.ticker).join("、") || "见原视频"}</p>
                  <p className="mt-1 text-xs text-muted-foreground sm:hidden">最近观点：<ReadingDate value={creator.latest_opinion_at} /></p>
                </div>
              </div>
              <span className={trailingDateClass}>最近观点：<ReadingDate value={creator.latest_opinion_at} /></span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            </Link>
          </ListRow>;
        })}
      </ListRows>
    </ListCard>
  );
}

export function StockDirectory({ stocks }: { stocks: YouTubeStockSummary[] }) {
  if (!stocks.length) return null;
  return (
    <ListCard>
      <DirectoryHeader lead="股票" trail="最近更新" />
      <ListRows aria-label="已收录股票">
        {stocks.map((stock) => <ListRow key={stock.ticker} data-reading-reveal data-reading-item="row">
          <Link href={publicStockPath(stock.ticker)} className={rowTargetClass}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <CompanyLogo symbol={stock.ticker} name={stock.company_name || stock.ticker} size="md" />
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-[15px] font-semibold">{stock.ticker}<span className="ml-3 font-normal text-muted-foreground">{stock.company_name}</span></h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{stock.creator_count} 位博主 · {stock.total_opinions} 条已收录观点</p>
                <p className="mt-1 text-xs text-muted-foreground sm:hidden">最近更新：<ReadingDate value={stock.latest_opinion_at} /></p>
              </div>
            </div>
            <span className={trailingDateClass}>最近更新：<ReadingDate value={stock.latest_opinion_at} /></span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
        </ListRow>)}
      </ListRows>
      {/* The stock rows above open their reading pages; this strip offers the same tickers
          as straight quotes-page shortcuts (each links to `/dashboard/market/<TICKER>`). */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-2 py-3">
        <span className="text-xs text-muted-foreground">直达行情</span>
        {stocks.map((stock) => {
          const quotesHref = marketStockUrl(stock.ticker);
          return quotesHref
            ? <Link key={stock.ticker} href={quotesHref} aria-label={`${stock.ticker} 行情`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none "><CompanyLogo symbol={stock.ticker} name={stock.company_name || stock.ticker} size="xs" /><span>{stock.ticker}</span></Link>
            : <span key={stock.ticker} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-xs text-muted-foreground">{stock.ticker}</span>;
        })}
      </div>
    </ListCard>
  );
}
