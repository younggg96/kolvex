"use client";

import { useCopy } from "@/components/decision/shared";
import type { FeedArticle } from "@/lib/newsFeed";

export default function NewsRows({ articles, translations, locale }: {
  articles: FeedArticle[]; translations: Record<string, string>; locale: string;
}) {
  const c = useCopy();
  let previousDay = "";
  return <ol className="divide-y divide-border/70">{articles.map(article => {
    const time = article.publish_time ? new Date(article.publish_time * 1000) : null;
    const day = time
      ? time.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" })
      : c("Undated", "日期未知");
    const showDay = day !== previousDay;
    previousDay = day;
    const translated = translations[article.title];
    return <li key={article.id}>
      {showDay && <div className="border-b border-border/70 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:px-8">{day}</div>}
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3 px-4 py-4 hover:bg-muted/30 lg:px-8">
        <time dateTime={time?.toISOString()} className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
          {time ? time.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
        </time>
        <a href={article.link} target="_blank" rel="noopener noreferrer" lang={translated ? "zh-CN" : "en"} className="block min-w-0 break-words rounded text-sm leading-relaxed text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {translated || article.title}<span className="sr-only">{c(" (original source, new tab)", "（原文，新标签页）")}</span>
        </a>
      </div>
    </li>;
  })}</ol>;
}
