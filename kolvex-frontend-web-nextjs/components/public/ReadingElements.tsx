import Link from "next/link";
import { formatOpinionDate } from "@/lib/opinionDates";
import { publicPagePath, publicResearchPath, publicStockPath } from "@/lib/publicRoutes";
import { creatorSharePath, sourceVideoUrl } from "@/lib/creatorSharing";
import type { TradingAnalysis } from "@/lib/tradingAnalysisApi";
import type { YouTubeOpinion } from "@/lib/youtubeOpinionsApi";

export function ReadingHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="mb-10 max-w-[72ch] space-y-4"><h1 className="break-words text-[28px] font-semibold tracking-tight md:text-[32px]">{title}</h1>{children && <p className="text-base leading-8 text-muted-foreground">{children}</p>}</div>;
}

export function ReadingDate({ value }: { value?: string | null }) {
  return value ? <time dateTime={value}>{formatOpinionDate(value, "zh-CN")}</time> : <span>日期未提供</span>;
}

export function ReadingPagination({ page, total, size, path }: { page: number; total: number; size: number; path: string }) {
  const pages = Math.ceil(total / size);
  if (pages <= 1) return null;
  return <nav aria-label="分页" className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm">
    {page > 1 ? <Link rel="prev" href={publicPagePath(path, page - 1)} className="rounded-sm px-3 py-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">上一页</Link> : <span />}
    <span aria-current="page">第 {page} / {pages} 页</span>
    {page < pages ? <Link rel="next" href={publicPagePath(path, page + 1)} className="rounded-sm px-3 py-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">下一页</Link> : <span />}
  </nav>;
}

export function ResearchList({ items }: { items: TradingAnalysis[] }) {
  return <div className="divide-y divide-border">{items.map((report) => <article key={report.id} className="py-6 first:pt-0">
    <Link href={publicResearchPath(report.id)} className="group block rounded-lg p-4 -mx-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <h2 className="text-xl font-semibold group-hover:underline">{report.ticker} 股票研究</h2>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><ReadingDate value={report.trade_date} /><span>{report.author?.full_name || report.author?.username || "Kolvex"}</span><span>已发布 AI 研究</span></p>
      <p className="mt-3 text-sm text-positive">阅读完整报告</p>
    </Link>
  </article>)}</div>;
}

export function OpinionList({ opinions }: { opinions: YouTubeOpinion[] }) {
  const labels: Record<string, string> = { bullish: "看多", bearish: "看空", neutral: "中性", mixed: "分歧" };
  return <div className="divide-y divide-border">{opinions.map((opinion) => {
    const source = sourceVideoUrl(opinion);
    return <article key={opinion.id} className="space-y-4 py-7 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold"><Link href={publicStockPath(opinion.ticker)} className="underline-offset-4 hover:underline">{opinion.ticker}</Link>{opinion.company_name && <span className="ml-3 text-sm font-normal text-muted-foreground">{opinion.company_name}</span>}</h3><span className="text-sm font-medium">{labels[opinion.sentiment] || "观点"}</span></div>
      <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><Link href={creatorSharePath(opinion.channel_id)} className="hover:underline">{opinion.channel_title || opinion.channel_handle || "查看博主"}</Link><span><ReadingDate value={opinion.opinion_date || opinion.video_published_at} />（美东日期）</span></p>
      <p className="max-w-[72ch] whitespace-pre-wrap break-words text-base leading-8">{opinion.summary || opinion.thesis || opinion.key_points?.join("\n") || "暂无文字摘要，请查看原视频。"}</p>
      {!!opinion.key_points?.length && <details className="text-sm"><summary className="cursor-pointer py-2 font-medium">观点依据</summary><ul className="list-disc space-y-2 pl-5 leading-7">{opinion.key_points.map((point, i) => <li key={i}>{point}</li>)}</ul></details>}
      {!!opinion.risks?.length && <details className="text-sm"><summary className="cursor-pointer py-2 font-medium">提及的风险</summary><ul className="list-disc space-y-2 pl-5 leading-7">{opinion.risks.map((risk, i) => <li key={i}>{risk}</li>)}</ul></details>}
      {source && <a href={source} target="_blank" rel="noopener noreferrer" className="inline-block py-2 text-sm text-positive underline underline-offset-4">{opinion.video_title || "查看原视频"}</a>}
    </article>;
  })}</div>;
}
