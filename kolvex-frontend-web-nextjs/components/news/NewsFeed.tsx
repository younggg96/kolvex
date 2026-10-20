"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bookmark, Clock3, Newspaper, Pause, Play, Radio, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { NEWS_CATEGORIES, articleCategories, filterNews, type NewsCategory, type FeedArticle } from "@/lib/newsFeed";
import { useNewsTerminal, useNewsBookmarks } from "./useNewsTerminal";
import NewsRows from "./NewsRows";
import NewsDetail from "./NewsDetail";

export default function NewsFeed() {
  const c = useCopy();
  const { locale } = useTranslation();
  const terminal = useNewsTerminal();
  const bookmarks = useNewsBookmarks();
  const [category, setCategory] = useState<NewsCategory>("all");
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState<FeedArticle | null>(null);
  const [wide, setWide] = useState(false);
  const [limit, setLimit] = useState(40);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { setLimit(40); scrollArea.current?.scrollTo({ top: 0 }); }, [category, query, focus, savedOnly]);
  const articles = useMemo(() => filterNews(terminal.feed.articles, category, query, focus, savedOnly, bookmarks.saved), [terminal.feed.articles, category, query, focus, savedOnly, bookmarks.saved]);
  const counts = useMemo(() => {
    const result: Record<string, number> = {all: terminal.feed.articles.length};
    for (const article of terminal.feed.articles) for (const id of articleCategories(article)) result[id] = (result[id] ?? 0) + 1;
    return result;
  }, [terminal.feed.articles]);
  const selectedArticle = terminal.feed.articles.find(a => a.id === selected?.id) ?? selected;
  const status = terminal.error || terminal.meta?.stale ? c("Update unavailable", "更新异常") : terminal.paused ? c("Paused", "已暂停") : c("Auto · 60s", "自动更新 · 60秒");
  const time = terminal.meta ? new Date(terminal.meta.fetched_at).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", {hour:"2-digit",minute:"2-digit",hour12:false}) : "—";
  const selectCategory = (id: NewsCategory) => { setCategory(id); setSavedOnly(false); };
  const reset = () => { setCategory("all"); setQuery(""); setFocus(false); setSavedOnly(false); };
  const detail = selectedArticle && <NewsDetail article={selectedArticle} saved={bookmarks.saved.includes(selectedArticle.id)} onSave={() => bookmarks.toggle(selectedArticle.id)} />;
  return <DashboardLayout title={c("News terminal", "新闻终端")} noTransition>
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div><div className="flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /><h1 className="text-lg font-semibold tracking-tight">{c("News terminal", "新闻终端")}</h1><span className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{c("DELAYED SOURCE", "延迟来源")}</span></div><p className="mt-1 text-xs text-muted-foreground">FinancialJuice RSS · {c("Last fetched", "上次获取")} {time}</p></div>
        <div className="flex items-center gap-1.5">
          <span role="status" className="mr-1 text-xs text-muted-foreground">{status}</span>
          <Button variant="outline" size="sm" aria-pressed={terminal.paused} onClick={terminal.togglePause}>{terminal.paused ? <Play className="mr-1.5 h-3.5 w-3.5" /> : <Pause className="mr-1.5 h-3.5 w-3.5" />}{terminal.paused ? c("Resume", "继续") : c("Pause", "暂停")}</Button>
          <Button variant="ghost" size="icon" aria-label={c("Refresh headlines", "刷新新闻")} disabled={terminal.loading} onClick={terminal.refresh}><RefreshCw className={cn("h-4 w-4", terminal.loading && "animate-spin motion-reduce:animate-none")} /></Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav aria-label={c("News categories", "新闻分类")} className="hidden w-44 shrink-0 flex-col border-r border-border px-3 py-5 xl:flex">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{c("Feeds", "新闻分类")}</p>
          {NEWS_CATEGORIES.map(item => <button key={item.id} type="button" aria-pressed={category === item.id && !savedOnly} onClick={() => selectCategory(item.id)} className={cn("mb-1 flex min-h-10 items-center justify-between gap-2 rounded px-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", category === item.id && !savedOnly ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}><span>{c(item.en, item.zh)}</span><span className="font-mono text-[11px] tabular-nums">{counts[item.id] ?? 0}</span></button>)}
          <div className="mt-5 border-t border-border pt-4"><Button variant={savedOnly ? "secondary" : "ghost"} size="sm" className="w-full justify-start" aria-pressed={savedOnly} onClick={() => { setSavedOnly(!savedOnly); setCategory("all"); }}><Bookmark className="mr-2 h-4 w-4" />{c("Saved", "已收藏")}</Button></div>
          <p className="mt-auto px-2 pt-6 text-[11px] leading-relaxed text-muted-foreground">{c("Categories and focus labels use Kolvex keyword rules. They are not FinancialJuice editorial tags.", "分类与重点标签由 Kolvex 关键词规则生成，不是 FinancialJuice 官方标签。")}</p>
        </nav>
        <section className="flex min-w-0 flex-1 flex-col" aria-label={c("Headlines", "快讯列表")}>
          <div className="space-y-3 border-b border-border px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-0 flex-1 basis-40"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden /><input type="search" aria-label={c("Search loaded headlines or symbols", "搜索已加载新闻或股票代码")} value={query} onChange={e => setQuery(e.target.value)} placeholder={c("Search headlines, $ticker…", "搜索快讯、$股票代码…")} className="h-10 w-full rounded border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" /></div>
              <Button variant={focus ? "secondary" : "outline"} aria-pressed={focus} onClick={() => setFocus(!focus)}><SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />{c("Focus · rules", "重点 · 规则")}</Button>
              <Button variant={savedOnly ? "secondary" : "outline"} className="xl:hidden" size="icon" aria-label={c("Show saved headlines", "查看收藏")} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}><Bookmark className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 xl:hidden" aria-label={c("News categories", "新闻分类")}>{NEWS_CATEGORIES.map(item => <Button key={item.id} variant={category === item.id ? "secondary" : "ghost"} size="sm" className="shrink-0" aria-pressed={category === item.id} onClick={() => selectCategory(item.id)}>{c(item.en, item.zh)}</Button>)}</div>
            <div className="flex flex-wrap justify-between gap-1 text-[11px] text-muted-foreground"><span>{c(`${articles.length} loaded headlines`, `${articles.length} 条已加载新闻`)}{savedOnly && c(" · saved on this device", " · 本设备收藏")}</span><span>{c("Keyword filters · local time", "关键词筛选 · 本地时间")}</span></div>
          </div>
          {(terminal.error || terminal.meta?.stale) && <div role="alert" className="border-b border-border bg-muted px-4 py-3 text-sm">{c("Source refresh failed. Showing the last available headlines; use Refresh to retry.", "来源更新失败，保留最近可用内容；请点击刷新重试。")}</div>}
          {bookmarks.storageError && <p role="status" className="px-4 py-2 text-xs text-muted-foreground">{c("Browser storage is unavailable. Bookmark changes may not persist.", "浏览器存储不可用，收藏更改可能无法保留。")}</p>}
          {terminal.feed.pending.length > 0 && <div aria-live="polite" className="border-b border-border p-2"><Button variant="secondary" size="sm" className="w-full" onClick={() => { terminal.reveal(); setLimit(40); scrollArea.current?.scrollTo({top:0}); }}><ArrowUp className="mr-2 h-4 w-4" />{c(`Show ${terminal.feed.pending.length} new headlines`, `查看 ${terminal.feed.pending.length} 条新消息`)}</Button></div>}
          <div ref={scrollArea} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {!terminal.feed.initialized && terminal.loading ? <div aria-busy="true" aria-label={c("Loading headlines", "正在加载新闻")} className="space-y-6 p-4">{Array.from({length:8}, (_, i) => <div key={i} className="flex gap-4"><Skeleton className="h-4 w-12" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div> : articles.length === 0 ? <div className="px-6 py-16 text-center"><Newspaper className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><h2 className="text-sm font-medium">{terminal.error ? c("News unavailable", "新闻暂不可用") : c("No matching headlines", "没有匹配的新闻")}</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">{c("Search and bookmarks only cover the loaded news window. Try clearing filters or refresh later.", "搜索和收藏筛选仅覆盖当前已加载新闻，可清除筛选或稍后刷新。")}</p><Button variant="outline" size="sm" className="mt-4" onClick={terminal.error ? terminal.refresh : reset}>{terminal.error ? c("Retry", "重试") : c("Clear filters", "清除筛选")}</Button></div> : <>
              <NewsRows articles={articles.slice(0,limit)} selectedId={selected?.id} saved={bookmarks.saved} locale={locale} onSelect={(article, element) => { trigger.current = element; setSelected(article); }} onSave={bookmarks.toggle} />
              {articles.length > limit && <div className="p-4"><Button variant="outline" className="w-full" onClick={() => setLimit(n => n + 40)}>{c("Show more loaded headlines", "显示更多已加载新闻")}</Button></div>}
              <p className="px-4 py-5 text-center text-[11px] text-muted-foreground">{c("Latest RSS window · not a complete archive", "最新 RSS 新闻窗口 · 非完整历史档案")}</p>
            </>}
          </div>
        </section>
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border xl:block" aria-label={c("Headline details", "新闻详情")}>
          <h2 className="border-b border-border px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c("Headline context", "新闻详情")}</h2>
          {detail || <div className="space-y-4 px-5 py-10"><Clock3 className="h-6 w-6 text-muted-foreground" /><h3 className="text-sm font-medium">{c("Follow the event. Open the market.", "读快讯，看行情。")}</h3><p className="text-sm leading-relaxed text-muted-foreground">{c("Select a headline to inspect its source, keyword categories and explicit stock mentions.", "选择一条新闻，查看来源、关键词分类及明确提及的股票。")}</p><p className="text-xs leading-relaxed text-muted-foreground">{c("FinancialJuice RSS may be delayed. This terminal checks every minute while visible; it does not provide the paid real-time feed.", "FinancialJuice RSS 可能延迟。页面可见时每分钟检查，不提供付费实时新闻流。")}</p></div>}
        </aside>
      </div>
    </div>
    <Sheet open={!!selected && !wide} onOpenChange={open => { if (!open) setSelected(null); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        <SheetTitle className="px-5 pt-5 text-sm">{c("Headline details", "新闻详情")}</SheetTitle>
        <SheetDescription className="sr-only">{c("Source, classifications and related symbols", "来源、分类与相关股票")}</SheetDescription>
        {detail}
      </SheetContent>
    </Sheet>
  </DashboardLayout>;
}
