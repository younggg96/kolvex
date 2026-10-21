"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Newspaper, Pause, Play, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useNewsTerminal } from "./useNewsTerminal";
import NewsRows from "./NewsRows";
import { useNewsTranslations } from "./useNewsTranslations";

export default function NewsFeed() {
  const c = useCopy();
  const { locale } = useTranslation();
  const terminal = useNewsTerminal();
  const [limit, setLimit] = useState(40);
  const scrollArea = useRef<HTMLDivElement>(null);
  const title = c("News terminal", "新闻终端");

  useEffect(() => { document.title = `${title} | Kolvex`; }, [title]);
  const articles = terminal.feed.articles;
  const visibleArticles = articles.slice(0, limit);
  const translation = useNewsTranslations(visibleArticles, locale);
  const status = terminal.error || terminal.meta?.stale
    ? c("Update unavailable", "更新异常")
    : terminal.paused ? c("Paused", "已暂停") : c("Auto · 60s", "自动更新 · 60秒");
  const time = terminal.meta
    ? new Date(terminal.meta.fetched_at).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";

  return <DashboardLayout title={title} noTransition
    headerExtra={<span className="text-xs text-muted-foreground">{c("Delayed headlines", "延迟快讯")}</span>}
    headerActions={<>
      <span role="status" className="mr-auto text-xs text-muted-foreground sm:mr-1">{translation.pending > 0 ? c("Translating…", "正在切换为中文…") : status}</span>
      <Button variant="outline" size="sm" aria-pressed={terminal.paused} onClick={terminal.togglePause}>
        {terminal.paused ? <Play aria-hidden className="h-3.5 w-3.5" /> : <Pause aria-hidden className="h-3.5 w-3.5" />}
        {terminal.paused ? c("Resume", "继续") : c("Pause", "暂停")}
      </Button>
      <Button variant="ghost" size="icon" aria-label={c("Refresh headlines", "刷新新闻")} disabled={terminal.loading} onClick={terminal.refresh}>
        <RefreshCw aria-hidden className={cn("h-4 w-4", terminal.loading && "animate-spin motion-reduce:animate-none")} />
      </Button>
    </>}>
      <section className="flex min-h-0 flex-1 flex-col bg-background" aria-label={c("Headlines", "快讯列表")}>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 text-xs text-muted-foreground lg:px-8">
          <span>{c(`${articles.length} loaded headlines`, `${articles.length} 条快讯`)}</span>
          <span>{c("Updated", "更新于")} {time} · {c("Local time", "本地时间")}</span>
        </div>
        {(terminal.error || terminal.meta?.stale) && <p role="alert" className="border-b border-border bg-muted px-4 py-3 text-sm lg:px-8">
          {c("Refresh failed. Showing the last available headlines; use Refresh to retry.", "更新失败，保留最近可用快讯；请点击刷新重试。")}
        </p>}
        {(translation.failed > 0 && translation.pending === 0) && <div role="status" className="flex min-h-10 flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground lg:px-8">
          {c("Some translations are unavailable; showing the original text.", "部分快讯暂未翻译，已保留原文。")}
          <Button variant="ghost" size="xs" onClick={translation.retry}>{c("Retry", "重试")}</Button>
        </div>}
        {terminal.feed.pending.length > 0 && <div aria-live="polite" className="border-b border-border p-2">
          <Button variant="secondary" size="sm" className="w-full" onClick={() => { terminal.reveal(); setLimit(40); scrollArea.current?.scrollTo({ top: 0 }); }}>
            <ArrowUp aria-hidden className="h-4 w-4" />{c(`Show ${terminal.feed.pending.length} new headlines`, `查看 ${terminal.feed.pending.length} 条新消息`)}
          </Button>
        </div>}
        <div ref={scrollArea} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!terminal.feed.initialized && terminal.loading ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />{c("Loading headlines…", "正在加载快讯…")}
          </div> : articles.length === 0 ? <div className="px-6 py-16 text-center">
            <Newspaper aria-hidden className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <h2 className="text-sm font-medium">{terminal.error ? c("News unavailable", "新闻暂不可用") : c("No headlines yet", "暂无快讯")}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{c("Refresh to check again later.", "可稍后刷新重试。")}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={terminal.refresh}>
              {c("Retry", "重试")}
            </Button>
          </div> : <>
            <NewsRows articles={visibleArticles} translations={translation.translations} locale={locale} />
            {articles.length > limit && <div className="p-4 lg:px-8"><Button variant="outline" className="w-full" onClick={() => setLimit(value => value + 40)}>{c("Show more headlines", "显示更多快讯")}</Button></div>}
          </>}
        </div>
      </section>
  </DashboardLayout>;
}
