"use client";

import { Bookmark } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useContentTranslation } from "@/components/trading-analysis/hooks";
import { TranslateButton } from "@/components/trading-analysis/translate";
import type { FeedArticle } from "@/lib/newsFeed";

function NewsRow({ article, saved, onSave, locale }: {
  article: FeedArticle; saved: boolean; onSave: (id: string) => void; locale: string;
}) {
  const c = useCopy();
  const { t } = useTranslation();
  const { displayContent, showTranslated, isTranslating, translationError, toggle } = useContentTranslation(article.title, locale);
  const time = article.publish_time ? new Date(article.publish_time * 1000) : null;

  return <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/30 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] lg:px-8">
    <time dateTime={time?.toISOString()} className="pt-2 font-mono text-xs tabular-nums text-muted-foreground">
      {time ? time.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
    </time>
    <div className="min-w-0 pt-1">
      <a href={article.link} target="_blank" rel="noopener noreferrer" lang={showTranslated ? "zh-CN" : undefined} className="block break-words rounded text-sm leading-relaxed text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {displayContent}<span className="sr-only">{c(" (original source, new tab)", "（原文，新标签页）")}</span>
      </a>
      {translationError && <p role="alert" className="mt-2 text-xs text-negative">{c("Translation failed. Original retained; select Translate to retry.", "翻译失败，已保留原文；点击翻译重试。")}</p>}
    </div>
    <div className="col-start-2 flex items-center sm:col-start-3 sm:row-start-1">
      <div className="w-36 shrink-0 [&_button]:w-full"><TranslateButton showTranslated={showTranslated} isTranslating={isTranslating} onToggle={toggle} t={t} /></div>
      <Button type="button" variant="ghost" size="icon" aria-label={saved ? c("Remove bookmark", "取消收藏") : c("Bookmark headline", "收藏新闻")} aria-pressed={saved} onClick={() => onSave(article.id)} className="h-10 w-10 text-muted-foreground">
        <Bookmark aria-hidden className="h-3.5 w-3.5" fill={saved ? "currentColor" : "none"} />
      </Button>
    </div>
  </div>;
}

export default function NewsRows({ articles, saved, onSave, locale }: {
  articles: FeedArticle[]; saved: string[]; onSave: (id: string) => void; locale: string;
}) {
  const c = useCopy();
  let previousDay = "";
  return <ol className="divide-y divide-border/70">{articles.map(article => {
    const day = article.publish_time
      ? new Date(article.publish_time * 1000).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" })
      : c("Undated", "日期未知");
    const showDay = day !== previousDay;
    previousDay = day;
    return <li key={article.id}>
      {showDay && <div className="border-b border-border/70 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:px-8">{day}</div>}
      <NewsRow article={article} saved={saved.includes(article.id)} locale={locale} onSave={onSave} />
    </li>;
  })}</ol>;
}
