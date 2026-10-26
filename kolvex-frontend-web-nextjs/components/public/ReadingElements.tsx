import Link from "next/link";
import { ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { StrengthIndicator } from "@/components/youtube/StrengthIndicator";
import { ResearchSummaryCard } from "@/components/trading-analysis/ResearchSummaryCard";
import { publicCopy } from "@/lib/publicCopy";
import { formatOpinionDate } from "@/lib/opinionDates";
import { publicPagePath, publicResearchPath, publicStockPath } from "@/lib/publicRoutes";
import { creatorSharePath, sourceVideoUrl } from "@/lib/creatorSharing";
import type { TradingAnalysis } from "@/lib/tradingAnalysisApi";
import type { YouTubeOpinion } from "@/lib/youtubeOpinionsApi";

export function ReadingHeading({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return <div data-reading-reveal className="mb-8 max-w-[72ch]">
    <div className="flex min-w-0 items-center gap-3">{icon}<h1 className="min-w-0 break-words text-[28px] font-bold leading-tight tracking-[-0.025em] md:text-[32px]">{title}</h1></div>
    {children && <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{children}</p>}
  </div>;
}

export function ReadingSectionHeading({ title, count, id }: { title: string; count?: number; id?: string }) {
  return <h2 data-reading-reveal id={id} className="mb-4 border-b border-border pb-3 text-[17px] font-semibold text-foreground">{title}{count !== undefined && <span className="figure ml-2 text-sm font-normal text-muted-foreground">{count}</span>}</h2>;
}

export function ReadingDate({ value }: { value?: string | null }) {
  return value ? <time dateTime={value} className="tabular-nums">{formatOpinionDate(value, "zh-CN")}</time> : <span>日期未提供</span>;
}

export function ReadingPagination({ page, total, size, path }: { page: number; total: number; size: number; path: string }) {
  const pages = Math.ceil(total / size);
  if (pages <= 1) return null;
  return <nav aria-label="分页" className="reading-pagination mt-6 flex flex-wrap items-center gap-3 text-sm">
    {page > 1 ? <Button asChild variant="outline" size="sm"><Link rel="prev" href={publicPagePath(path, page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" />上一页</Link></Button> : <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4" aria-hidden="true" />上一页</Button>}
    <span aria-current="page" className="figure text-muted-foreground">第 {page} / {pages} 页</span>
    {page < pages ? <Button asChild variant="outline" size="sm"><Link rel="next" href={publicPagePath(path, page + 1)}>下一页<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link></Button> : <Button variant="outline" size="sm" disabled>下一页<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>}
  </nav>;
}

export function ResearchList({ items, layout = "grid" }: { items: TradingAnalysis[]; layout?: "grid" | "stack" }) {
  return <ul className={layout === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid min-w-0 grid-cols-1 gap-4"}>{items.map((report) => <li key={report.id} data-reading-reveal data-reading-item="card" className="min-w-0"><ResearchSummaryCard analysis={report} href={publicResearchPath(report.id)} t={publicCopy} /></li>)}</ul>;
}

export function OpinionList({ opinions }: { opinions: YouTubeOpinion[] }) {
  return <div className="divide-y divide-border">{opinions.map((opinion) => {
    const source = sourceVideoUrl(opinion);
    const name = opinion.channel_title || opinion.channel_handle || "查看博主";
    return <article key={opinion.id} className="min-w-0 py-6 first:pt-2 [overflow-wrap:anywhere]">
      <header className="flex min-w-0 items-start gap-3">
        <CreatorAvatar name={name} avatarUrl={opinion.channel_avatar_url} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link href={creatorSharePath(opinion.channel_id)} className="rounded-sm text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{name}</Link>
            <h3><Link href={publicStockPath(opinion.ticker)} className="inline-flex items-center gap-2 rounded-sm text-[15px] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><CompanyLogo symbol={opinion.ticker} size="xs" /><span>{opinion.ticker}</span></Link></h3>
            <span className="text-xs text-muted-foreground"><ReadingDate value={opinion.opinion_date || opinion.video_published_at} />（美东日期）</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1"><StrengthIndicator value={opinion.direction_score} t={publicCopy} />{opinion.sentiment === "mixed" && <span className="text-xs font-medium text-warning">分歧</span>}</div>
        </div>
      </header>
      {opinion.company_name && <p className="mt-3 text-xs text-muted-foreground">{opinion.company_name}</p>}
      <p className="mt-4 max-w-[72ch] whitespace-pre-wrap text-[15px] leading-7 text-foreground">{opinion.summary || opinion.thesis || opinion.key_points?.join("\n") || "暂无文字摘要，请查看原视频。"}</p>
      {!!(opinion.key_points?.length || opinion.risks?.length) && <div className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
        {[{ title: "观点依据", items: opinion.key_points }, { title: "提及的风险", items: opinion.risks }].map(({ title, items }) => !!items?.length && <details key={title} className="text-sm"><summary className="cursor-pointer rounded-sm py-2 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{title}</summary><ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">{items.map((item, i) => <li key={i}>{item}</li>)}</ul></details>)}
      </div>}
      {source && <a href={source} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex max-w-full items-start gap-2 rounded-sm py-1 text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><PlayCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0">{opinion.video_title || "查看原视频"}</span></a>}
    </article>;
  })}</div>;
}
