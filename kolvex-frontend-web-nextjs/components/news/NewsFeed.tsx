"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Newspaper, Pause, Play, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ListCard, ListLoadMore, ListToolbar } from "@/components/ui/list-card";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useNewsTerminal } from "./useNewsTerminal";
import NewsRows, { NewsRowsSkeleton } from "./NewsRows";
import { useNewsTranslations } from "./useNewsTranslations";

export default function NewsFeed() {
  const c = useCopy();
  const { locale } = useTranslation();
  const terminal = useNewsTerminal();
  const [limit, setLimit] = useState(40);
  const [query, setQuery] = useState("");
  const scrollArea = useRef<HTMLDivElement>(null);
  const title = c("News terminal", "新闻终端");

  useEffect(() => { document.title = `${title} | Kolvex`; }, [title]);
  const articles = terminal.feed.articles;
  const needle = query.trim().toLowerCase();
  // While searching, translate every loaded headline so Chinese keywords can match too.
  const translation = useNewsTranslations(needle ? articles : articles.slice(0, limit), locale);
  const matches = needle
    ? articles.filter(article => [article.title, translation.translations[article.title] ?? "", ...(article.symbols ?? [])]
      .some(text => text.toLowerCase().includes(needle.replace(/^\$/, ""))))
    : articles;
  const visibleArticles = matches.slice(0, limit);
  const status = terminal.error || terminal.meta?.stale
    ? c("Update unavailable", "更新异常")
    : terminal.paused ? c("Paused", "已暂停") : c("Auto · 60s", "自动更新 · 60秒");
  const time = terminal.meta
    ? new Date(terminal.meta.fetched_at).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";

  return <DashboardLayout title={title} noTransition>
      <section className="flex min-h-0 flex-1 flex-col bg-background dark:bg-transparent" aria-label={c("Headlines", "快讯列表")}>
        <div className="flex min-h-0 flex-1 flex-col md:px-8 md:pb-6 md:pt-6">
          <ListCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ListToolbar className="shrink-0 border-b border-border pb-3 text-xs leading-5 text-muted-foreground max-md:flex-nowrap max-md:px-[16px] max-md:py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span>{terminal.loading && !terminal.meta ? <Skeleton className="h-3 w-28" /> : c(`${articles.length} loaded headlines`, `${articles.length} 条快讯`)}</span>
                <span className="max-md:hidden">{c("Delayed headlines", "延迟快讯")}</span>
                <span>{c("Updated", "更新于")} {time}<span className="max-md:hidden"> · {c("Local time", "本地时间")}</span></span>
              </div>
              <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                <span role="status" className="max-md:sr-only">{translation.pending > 0 ? c("Translating…", "正在切换为中文…") : status}</span>
                <Button variant="outline" size="sm" className="max-md:!w-9 max-md:!p-0" aria-pressed={terminal.paused} onClick={terminal.togglePause}>
                  {terminal.paused ? <Play aria-hidden className="h-3.5 w-3.5" /> : <Pause aria-hidden className="h-3.5 w-3.5" />}
                  <span className="max-md:sr-only">{terminal.paused ? c("Resume", "继续") : c("Pause", "暂停")}</span>
                </Button>
                <Button variant="ghost" size="icon" aria-label={c("Refresh headlines", "刷新新闻")} disabled={terminal.loading} onClick={terminal.refresh}>
                  <RefreshCw aria-hidden className={cn("h-4 w-4", terminal.loading && "animate-spin motion-reduce:animate-none")} />
                </Button>
              </div>
            </ListToolbar>
            <div className="shrink-0 border-b border-border/70 py-2 max-md:px-[16px]">
              <SearchInput
                size="sm"
                containerClassName="w-full md:max-w-sm"
                className="w-full"
                aria-label={c("Search headlines", "搜索快讯")}
                placeholder={c("Search headlines or tickers", "搜索快讯关键词或股票代码")}
                value={query}
                onChange={event => { setQuery(event.target.value); setLimit(40); }}
              />
              {needle && <p role="status" className="mt-1.5 text-xs text-muted-foreground">
                {c(`${matches.length} of ${articles.length} headlines match`, `${articles.length} 条中匹配 ${matches.length} 条`)}
                {translation.pending > 0 && c(" · translating, results may grow", " · 正在翻译，结果可能增加")}
              </p>}
            </div>
            {(terminal.error || terminal.meta?.stale) && <p role="alert" className="shrink-0 border-b border-border/70 py-2 text-sm max-md:px-[16px]">
              {c("Refresh failed. Showing the last available headlines.", "更新失败，正在显示最近可用的快讯。")}
            </p>}
            {(translation.failed > 0 && translation.pending === 0) && <div role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 py-2 text-xs text-muted-foreground max-md:px-[16px]">
              <span>{c("Some translations are unavailable; showing the original text.", "部分快讯暂未翻译，已保留原文。")}</span>
              <Button variant="ghost" size="xs" onClick={translation.retry}>{c("Retry", "重试")}</Button>
            </div>}
            {terminal.feed.pending.length > 0 && <div aria-live="polite" className="shrink-0 border-b border-border/70 py-2 max-md:px-[16px]">
              <Button variant="secondary" size="sm" className="w-full" onClick={() => { terminal.reveal(); setLimit(40); scrollArea.current?.scrollTo({ top: 0 }); }}>
                <ArrowUp aria-hidden className="h-4 w-4" />{c(`Show ${terminal.feed.pending.length} new headlines`, `查看 ${terminal.feed.pending.length} 条新消息`)}
              </Button>
            </div>}
            <div ref={scrollArea} data-nav-underlay className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {!terminal.feed.initialized && terminal.loading ? <NewsRowsSkeleton label={c("Loading headlines…", "正在加载快讯…")} /> : articles.length === 0 ? <div className="px-6 py-16 text-center">
                <Newspaper aria-hidden className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                <h2 className="text-sm font-medium">{terminal.error ? c("News unavailable", "新闻暂不可用") : c("No headlines yet", "暂无快讯")}</h2>
                <Button variant="outline" size="sm" className="mt-4" onClick={terminal.refresh}>
                  {c("Retry", "重试")}
                </Button>
              </div> : needle && matches.length === 0 ? <p className="px-6 py-16 text-center text-sm text-muted-foreground">
                {c("No headlines match this search.", "没有匹配的快讯。")}
              </p> : <>
                <NewsRows articles={visibleArticles} translations={translation.translations} locale={locale} />
                {matches.length > limit && <ListLoadMore onClick={() => setLimit(value => value + 40)}>{c("Show more headlines", "显示更多快讯")}</ListLoadMore>}
              </>}
            </div>
          </ListCard>
        </div>
      </section>
  </DashboardLayout>;
}
