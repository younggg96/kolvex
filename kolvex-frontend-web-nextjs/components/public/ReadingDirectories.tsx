import Link from "next/link";
import { ChevronRight } from "lucide-react";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import CompanyLogo from "@/components/ui/company-logo";
import { creatorSharePath } from "@/lib/creatorSharing";
import { publicStockPath } from "@/lib/publicRoutes";
import type { YouTubeCreatorSummary, YouTubeStockSummary } from "@/lib/youtubeOpinionsApi";
import { ReadingDate } from "./ReadingElements";

const rowClass = "group flex min-w-0 items-center gap-3 border-b border-border py-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:-mx-3 sm:rounded-xl sm:border-transparent sm:px-3";

export function CreatorDirectory({ creators }: { creators: YouTubeCreatorSummary[] }) {
  return <ul>{creators.map((creator) => {
    const name = creator.channel_title || creator.channel_handle || "财经博主";
    return <li key={creator.channel_id} data-reading-reveal data-reading-item="row"><Link href={creatorSharePath(creator.channel_id)} className={rowClass}>
      <CreatorAvatar name={name} avatarUrl={creator.channel_avatar_url} size="md" />
      <div className="min-w-0 flex-1"><h2 className="break-words text-[15px] font-semibold">{name}</h2><p className="mt-1 break-words text-xs leading-6 text-muted-foreground">关注股票：{creator.top_tickers.map((stock) => stock.ticker).join("、") || "见原视频"}</p><p className="mt-1 text-xs text-muted-foreground sm:hidden">最近观点：<ReadingDate value={creator.latest_opinion_at} /></p></div>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">最近观点：<ReadingDate value={creator.latest_opinion_at} /></span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
    </Link></li>;
  })}</ul>;
}

export function StockDirectory({ stocks }: { stocks: YouTubeStockSummary[] }) {
  return <ul>{stocks.map((stock) => <li key={stock.ticker} data-reading-reveal data-reading-item="row"><Link href={publicStockPath(stock.ticker)} className={rowClass}>
    <CompanyLogo symbol={stock.ticker} name={stock.company_name || stock.ticker} size="md" />
    <div className="min-w-0 flex-1"><h2 className="break-words text-[15px] font-semibold">{stock.ticker}<span className="ml-3 font-normal text-muted-foreground">{stock.company_name}</span></h2><p className="mt-1 text-xs leading-6 text-muted-foreground">{stock.creator_count} 位博主 · {stock.total_opinions} 条已收录观点</p><p className="mt-1 text-xs text-muted-foreground sm:hidden">最近更新：<ReadingDate value={stock.latest_opinion_at} /></p></div>
    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">最近更新：<ReadingDate value={stock.latest_opinion_at} /></span>
    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
  </Link></li>)}</ul>;
}
