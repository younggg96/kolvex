"use client";
import { Bookmark, ChevronRight } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { cn } from "@/lib/utils";
import { isFocusHeadline, type FeedArticle } from "@/lib/newsFeed";

export default function NewsRows({ articles, selectedId, saved, onSelect, onSave, locale }: {
  articles: FeedArticle[]; selectedId?: string; saved: string[]; locale: string;
  onSelect: (article: FeedArticle, trigger: HTMLButtonElement) => void; onSave: (id: string) => void;
}) {
  const c = useCopy();
  const format = (timestamp: number, dateOnly: boolean) => new Date(timestamp * 1000).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", dateOnly ? {year:"numeric",month:"short",day:"numeric"} : {hour:"2-digit",minute:"2-digit",hour12:false});
  let previousDay = "";
  return <ol className="divide-y divide-border/70">{articles.map(article => {
    const day = article.publish_time ? format(article.publish_time, true) : c("Undated", "日期未知");
    const showDay = day !== previousDay;
    previousDay = day;
    const focused = isFocusHeadline(article);
    const bookmarked = saved.includes(article.id);
    return <li key={article.id}>
      {showDay && <div className="border-b border-border/70 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">{day}</div>}
      <div className={cn("group flex items-start gap-1 px-3 py-3 transition-colors hover:bg-muted/40", selectedId === article.id && "bg-primary/5 ring-1 ring-inset ring-primary/30")}>
        <button type="button" onClick={event => onSelect(article, event.currentTarget)} aria-pressed={selectedId === article.id} className="flex min-w-0 flex-1 gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <time dateTime={article.publish_time ? new Date(article.publish_time * 1000).toISOString() : undefined} className="w-11 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{article.publish_time ? format(article.publish_time, false) : "—"}</time>
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-relaxed">{article.title}</span>
            <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {focused && <span className="font-semibold text-primary">{c("FOCUS · RULE", "重点 · 规则")}</span>}
              {article.symbols.map(s => <span key={s} className="rounded border border-border px-1.5 py-0.5 font-mono">{s}</span>)}
              <span>FinancialJuice</span>
            </span>
          </span>
          <ChevronRight aria-hidden className="mt-1 hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
        </button>
        <button type="button" aria-label={bookmarked ? c("Remove bookmark", "取消收藏") : c("Bookmark headline", "收藏新闻")} aria-pressed={bookmarked} onClick={() => onSave(article.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Bookmark className="h-3.5 w-3.5" fill={bookmarked ? "currentColor" : "none"} /></button>
      </div>
    </li>;
  })}</ol>;
}
