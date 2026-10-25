"use client";

import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { useNewsTranslations } from "@/components/news/useNewsTranslations";
import { Empty, Panel, useCopy } from "./shared";
import { useStockNews } from "./useStockNews";

export default function StockNews({ ticker }: { ticker: string }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const news = useStockNews(ticker);
  const [expanded, setExpanded] = useState(false);
  const visible = news.articles.slice(0, expanded ? 30 : 5);
  const translation = useNewsTranslations(visible.map(item => ({ ...item, id: item.uuid || item.link, symbols: [ticker] })), locale);
  const intlLocale = locale === "zh" ? "zh-CN" : "en-US";

  return <Panel id="stock-news" title={c("Latest related news", "最新相关新闻")}
    description={c(`${ticker} · Source headlines, checked every 5 minutes. Publication may be delayed.`, `${ticker} · 每 5 分钟检查更新，新闻发布可能存在延迟。`)}
    action={<Button variant="outline" size="sm" disabled={news.loading} onClick={news.refresh}>
      <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${news.loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
      {news.loading ? c("Refreshing…", "更新中…") : c("Refresh", "刷新")}
    </Button>}>
    {news.error && <div role="alert" className="flex flex-wrap items-center gap-2 py-3 text-sm text-muted-foreground">
      <span>{news.articles.length
        ? c("Update failed. Showing the last available news.", "更新失败，已保留上次获取的新闻。")
        : c("News could not be loaded. Please retry.", "新闻暂时无法加载，请重试。")}</span>
      <Button variant="ghost" size="sm" onClick={news.refresh} disabled={news.loading}>{c("Retry", "重试")}</Button>
    </div>}
    {news.loading && !news.articles.length ? <div role="status" className="space-y-4 py-4">
      <span className="sr-only">{c("Loading stock news", "正在加载个股新闻")}</span>
      {[0, 1, 2].map(item => <Skeleton key={item} className="h-20 w-full" />)}
    </div> : news.articles.length ? <>
      <ul className="divide-y divide-border">{visible.map(item => {
        const published = item.publish_time ? new Date(item.publish_time * 1000) : null;
        const validDate = published && Number.isFinite(published.getTime()) ? published : null;
        return <li key={item.link} className="py-4">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{item.publisher || c("News source", "新闻来源")}</span>
            {validDate && <><span aria-hidden>·</span><time dateTime={validDate.toISOString()}>{validDate.toLocaleString(intlLocale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></>}
          </div>
          <a href={item.link} target="_blank" rel="noopener noreferrer" lang={translation.translations[item.title] ? "zh-CN" : "en"}
            className="rounded text-sm font-semibold leading-6 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {translation.translations[item.title] || item.title}
            <ExternalLink aria-hidden className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
            <span className="sr-only">{c(" (original source, new tab)", "（原文，新标签页）")}</span>
          </a>
          {item.summary && <p lang="en" className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.summary}</p>}
        </li>;
      })}</ul>
      {news.articles.length > 5 && <Button variant="ghost" size="sm" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        {expanded ? c("Show less", "收起") : c(`Show all ${news.articles.length} articles`, `查看全部 ${news.articles.length} 条新闻`)}
      </Button>}
    </> : !news.error && <Empty>{c("No recent related news is available for this stock.", "暂时没有这只股票的最新相关新闻。")}</Empty>}
    <div role="status" className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {translation.pending > 0 ? c("Translating headlines…", "正在翻译标题…") : translation.failed > 0 ? <>
        {c("Some headlines are shown in their original language.", "部分标题暂未翻译，已保留原文。")}
        <Button variant="ghost" size="xs" onClick={translation.retry}>{c("Retry translation", "重试翻译")}</Button>
      </> : null}
      {news.updatedAt && <span>{c("Last checked", "检查于")} {news.updatedAt.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })} · {c("Local time", "本地时间")}</span>}
    </div>
  </Panel>;
}
