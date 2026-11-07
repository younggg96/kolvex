"use client";

import { useCopy } from "@/components/decision/shared";
import { listFeedRowClass } from "@/components/ui/list-card";
import { ContentLoading, SkeletonRepeat } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FeedArticle } from "@/lib/newsFeed";

export default function NewsRows({ articles, translations, locale }: {
  articles: FeedArticle[]; translations: Record<string, string>; locale: string;
}) {
  const c = useCopy();
  let previousDay = "";
  return <ol className="min-w-0">
    {articles.map(article => {
      const time = article.publish_time ? new Date(article.publish_time * 1000) : null;
      const day = time
        ? time.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" })
        : c("Undated", "日期未知");
      const showDay = day !== previousDay;
      previousDay = day;
      const translated = translations[article.title];
      return <li key={article.id} className={cn(
        listFeedRowClass,
        "px-2 max-md:!px-[16px] max-md:!py-2.5 motion-reduce:transition-none",
      )}>
        {showDay && <p className="mb-2 text-xs font-medium text-muted-foreground">{day}</p>}
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3">
          <time dateTime={time?.toISOString()} className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {time ? time.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
          </time>
          <a href={article.link} target="_blank" rel="noopener noreferrer" lang={translated ? "zh-CN" : "en"} className="block min-w-0 break-words rounded-sm text-sm leading-relaxed text-foreground underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none">
            {translated || article.title}<span className="sr-only">{c(" (original source, new tab)", "（原文，新标签页）")}</span>
          </a>
        </div>
      </li>;
    })}
  </ol>;
}

/** Placeholder in the shape of NewsRows: a day label, then time + one/two-line headline rows. */
export function NewsRowsSkeleton({ label, rows = 8 }: { label?: string; rows?: number }) {
  return <ContentLoading label={label} className="min-h-0">
    <ol className="min-w-0">
      <SkeletonRepeat count={rows}>{i => <li className={cn(listFeedRowClass, "px-2 max-md:!px-[16px] max-md:!py-2.5")}>
        {i === 0 && <Skeleton className="mb-2 h-3.5 w-24 rounded-md" />}
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3">
          <Skeleton className="mt-1 h-3.5 w-10 rounded-md" />
          <div className="flex flex-col gap-2 py-0.5">
            <Skeleton className="h-4 w-full rounded-md" />
            {i % 3 !== 2 && <Skeleton className={cn("h-4 rounded-md", i % 2 ? "w-2/3" : "w-1/2")} />}
          </div>
        </div>
      </li>}</SkeletonRepeat>
    </ol>
  </ContentLoading>;
}
