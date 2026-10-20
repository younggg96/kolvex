"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ExternalLink, Newspaper, Pause, Play, RefreshCw, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EMPTY_FEED, NEWS_PRESETS, parseNewsSymbols, receiveNews, revealNews } from "@/lib/newsFeed";

export default function NewsFeed() {
  const c = useCopy();
  const [symbols, setSymbols] = useState("SPY,QQQ,DIA");
  const [input, setInput] = useState("");
  const [invalid, setInvalid] = useState(false);
  return (
    <DashboardLayout title={c("News", "新闻流")}>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-8">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">{c("Market news", "市场新闻流")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{c("Source-linked headlines for the symbols you follow.", "按关注标的聚合新闻，随时查看原文和行情。")}</p>
          </header>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" aria-label={c("News categories", "新闻分类")}>
              {NEWS_PRESETS.map(preset => (
                <Button key={preset.id} variant={symbols === preset.symbols.join(",") ? "default" : "outline"} size="sm" aria-pressed={symbols === preset.symbols.join(",")} onClick={() => { setSymbols(preset.symbols.join(",")); setInput(""); setInvalid(false); }}>
                  {c(preset.en, preset.zh)}
                </Button>
              ))}
            </div>
            <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
              event.preventDefault();
              const parsed = parseNewsSymbols(input);
              setInvalid(!parsed);
              if (parsed) setSymbols(parsed.join(","));
            }}>
              <div className="min-w-0 flex-1 sm:max-w-sm">
                <label htmlFor="news-symbols" className="mb-1.5 block text-xs text-muted-foreground">{c("Or enter up to 4 symbols, separated by commas", "或输入最多 4 个股票代码，用逗号分隔")}</label>
                <input id="news-symbols" value={input} onChange={event => setInput(event.target.value)} placeholder="AAPL, NVDA" aria-invalid={invalid} aria-describedby={invalid ? "news-symbol-error" : undefined} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              </div>
              <Button type="submit" variant="outline">{c("Apply", "应用")}</Button>
            </form>
            {invalid && <p id="news-symbol-error" role="alert" className="text-sm text-destructive">{c("Enter 1–4 valid symbols, e.g. AAPL, NVDA.", "请输入 1–4 个有效代码，例如 AAPL, NVDA。")}</p>}
          </div>
          <FeedTimeline key={symbols} symbols={symbols} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function FeedTimeline({ symbols }: { symbols: string }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const [feed, setFeed] = useState(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const top = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let active = true;
    let busy = false;
    let controller: AbortController | undefined;
    async function refresh() {
      if (busy) return;
      busy = true;
      controller = new AbortController();
      setLoading(true);
      try {
        const response = await fetch(`/api/news?symbols=${encodeURIComponent(symbols)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("News unavailable");
        const data = await response.json();
        if (!Array.isArray(data.articles)) throw new Error("Invalid news response");
        if (!active) return;
        setFeed(previous => receiveNews(previous, data.articles));
        setUnavailable(data.unavailable ?? []);
        setCheckedAt(data.checked_at);
        setError(false);
      } catch {
        if (active) setError(true);
      } finally {
        busy = false;
        if (active) setLoading(false);
      }
    }
    void refresh();
    const poll = () => { if (!document.hidden && !pausedRef.current) void refresh(); };
    const timer = setInterval(poll, 60_000);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("online", poll);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("online", poll);
    };
  }, [symbols, attempt]);

  const articles = feed.articles.filter(article => `${article.title} ${article.publisher ?? ""} ${article.symbols.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const formatDate = (value: string | number) => new Date(typeof value === "number" ? value * 1000 : value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <section ref={top} className="scroll-mt-4 space-y-3" aria-label={c("News feed", "新闻列表")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-sm font-medium">{symbols.split(",").join(" · ")}</p>
          <p className="mt-1 text-xs text-muted-foreground" role="status">{checkedAt ? `${c("Last checked", "上次检查")} ${formatDate(checkedAt)}` : c("Waiting for headlines", "等待新闻加载")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" aria-pressed={paused} onClick={() => { setPaused(!paused); if (paused) setAttempt(a => a + 1); }}>
            {paused ? <Play className="mr-1.5 h-3.5 w-3.5" /> : <Pause className="mr-1.5 h-3.5 w-3.5" />}
            {paused ? c("Resume", "继续更新") : c("Pause", "暂停更新")}
          </Button>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => setAttempt(a => a + 1)}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin motion-reduce:animate-none")} />{c("Refresh", "刷新")}
          </Button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{c("Latest available Yahoo Finance headlines for these symbols. Checks every minute while this page is visible; source publication may be delayed. Categories are symbol groups, not editorial tags.", "展示 Yahoo Finance 提供的标的相关新闻。页面可见时每分钟检查一次，来源发布可能有延迟；分类按标的分组，并非文章内容标签。")}</p>
      <div className="relative">
        <Search aria-hidden className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input aria-label={c("Search loaded headlines", "搜索已加载新闻")} value={query} onChange={event => { setQuery(event.target.value); setLimit(20); }} placeholder={c("Search loaded headlines or sources…", "搜索已加载的标题或来源…")} className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
      </div>
      {error && <div role="alert" className="rounded-md border border-destructive/30 p-3 text-sm">{c("Could not refresh news. Existing headlines are retained. Try Refresh again.", "新闻更新失败，已保留当前内容。请点击刷新重试。")}</div>}
      {unavailable.length > 0 && <p role="status" className="text-sm text-muted-foreground">{c("Temporarily unavailable:", "以下标的暂时不可用：")} {unavailable.join(", ")}</p>}
      <div aria-live="polite">
        {feed.pending.length > 0 && <Button variant="secondary" className="w-full" onClick={() => { setFeed(revealNews); setLimit(20); top.current?.scrollIntoView({ block: "start" }); }}>
          <ArrowUp className="mr-2 h-4 w-4" />{c(`Show ${feed.pending.length} new headlines`, `查看 ${feed.pending.length} 条新消息`)}
        </Button>}
      </div>
      {!feed.initialized && loading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">{c("Loading headlines…", "正在加载新闻…")}</p> : articles.length === 0 && !error ? (
        <div className="py-12 text-center text-muted-foreground">
          <Newspaper aria-hidden className="mx-auto mb-3 h-6 w-6" />
          <p className="text-sm">{query ? c("No loaded headlines match your search.", "已加载新闻中没有匹配结果。") : c("No headlines returned for these symbols. Try another group or refresh later.", "来源暂未返回这些标的的新闻，请切换分类或稍后刷新。")}</p>
        </div>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-background/80">
          {articles.slice(0, limit).map(article => (
            <li key={article.id} className="px-4 py-4 sm:px-5">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {article.publish_time ? <time dateTime={new Date(article.publish_time * 1000).toISOString()}>{formatDate(article.publish_time)}</time> : <span>{c("Time unavailable", "时间未知")}</span>}
                <span>{article.publisher || c("Unknown publisher", "来源未知")}</span>
              </div>
              <a href={article.link} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-2 rounded text-[15px] font-medium leading-relaxed hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                {article.title}<ExternalLink aria-hidden className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="sr-only">{c("(opens original in a new tab)", "（新标签页打开原文）")}</span>
              </a>
              <div className="mt-2 flex flex-wrap gap-2">
                {article.symbols.map(symbol => <Link key={symbol} href={`/dashboard/market/${encodeURIComponent(symbol)}`} className="rounded bg-muted px-2 py-1 text-xs font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{symbol}</Link>)}
              </div>
            </li>
          ))}
        </ol>
      )}
      {articles.length > limit && <Button variant="outline" className="w-full" onClick={() => setLimit(n => n + 20)}>{c("Show more loaded headlines", "显示更多已加载新闻")}</Button>}
    </section>
  );
}
