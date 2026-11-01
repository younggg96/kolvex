"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Search, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import XCreatorProfile, { CreatorAvatar } from "./XCreatorProfile";
import XTranslatedText from "./XTranslatedText";
import StockBadge from "@/components/ui/stock-badge";
import { useTranslation } from "@/lib/i18n";
import { xRequest, type XCreator, type XFeed } from "@/lib/xContentApi";

export default function XContentExplorer() {
  const { locale } = useTranslation();
  const c = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const router = useRouter();
  const params = useSearchParams();
  const author = params.get("author") || "";
  const ticker = params.get("ticker") || "";
  const rawPage = Number(params.get("page") || "1");
  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 5001
      ? rawPage
      : 1;
  const [creators, setCreators] = useState<XCreator[]>([]);
  const [feed, setFeed] = useState<XFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [draftTicker, setDraftTicker] = useState(ticker);
  const [filterError, setFilterError] = useState("");
  const tickerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraftTicker(ticker);
  }, [ticker]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    let active = true;
    setLoading(true);
    setError("");
    setFeed(null);
    const query = new URLSearchParams({
      limit: "20",
      offset: String((page - 1) * 20),
    });
    if (author) query.set("author", author);
    if (ticker) query.set("ticker", ticker);
    Promise.all([
      xRequest<{ creators: XCreator[] }>("creators", {
        signal: controller.signal,
      }),
      xRequest<XFeed>(`posts?${query}`, { signal: controller.signal }),
    ])
      .then(([profiles, result]) => {
        if (active) {
          setCreators(profiles.creators);
          setFeed(result);
        }
      })
      .catch(() => {
        if (active)
          setError(
            c(
              "Could not load X content. Please retry.",
              "无法加载 X 内容，请重试。",
            ),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
    // The request state follows the active locale as well as the URL filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author, ticker, page, revision, locale]);

  function href(values: { author?: string; ticker?: string; page?: number }) {
    const next = new URLSearchParams();
    const nextAuthor = values.author ?? author;
    const nextTicker = values.ticker ?? ticker;
    if (nextAuthor) next.set("author", nextAuthor);
    if (nextTicker) next.set("ticker", nextTicker);
    if ((values.page ?? 1) > 1) next.set("page", String(values.page));
    return `/dashboard/x-opinions${next.size ? `?${next}` : ""}`;
  }
  const selected = creators.find((creator) => creator.username === author);
  const format = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US");
  const metrics: Record<string, string> = {
    replies: c("Replies", "回复"),
    reposts: c("Reposts", "转发"),
    likes: c("Likes", "点赞"),
    bookmarks: c("Bookmarks", "收藏"),
    views: c("Views", "浏览"),
  };
  const focusClass =
    "rounded-full transition-colors duration-150 focus-visible:outline-none ";

  return (
    <DashboardLayout title={c("X creator posts", "X 博主内容")}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 pb-16 pt-5 md:px-8 md:pt-7">
        <h1 className="sr-only">{c("X creator posts", "X 博主内容")}</h1>
        <div className="mx-auto w-full space-y-6">
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
            <aside className="order-1 min-w-0 xl:col-start-2 xl:row-start-1">
              <h2 className="mb-3 text-base font-semibold">
                {c("Creators", "博主")}
              </h2>
              <nav
                aria-label={c("Filter by creator", "按博主筛选")}
                className="flex flex-wrap gap-2 lg:flex-col"
              >
                <Link
                  href={href({ author: "" })}
                  aria-current={!author ? "page" : undefined}
                  className={`${focusClass} px-3 py-2 text-sm ${!author ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {c("All creators", "全部博主")}
                </Link>
                {creators.map((creator) => (
                  <Link
                    key={creator.username}
                    href={href({ author: creator.username })}
                    aria-current={
                      author === creator.username ? "page" : undefined
                    }
                    className={`${focusClass} min-w-0 px-3 py-2 text-sm ${author === creator.username ? "bg-muted font-semibold" : "hover:bg-muted"}`}
                  >
                    <span className="flex items-center gap-3">
                      <CreatorAvatar creator={creator} username={creator.username} />
                      <span className="min-w-0"><span className="block break-words font-medium">{creator.display_name}</span><span className="text-xs text-muted-foreground">@{creator.username}</span></span>
                    </span>
                  </Link>
                ))}
              </nav>
              {creators.length === 1 && !selected && <div className="mt-6"><XCreatorProfile creator={creators[0]} /></div>}
            </aside>
            <div className="order-2 min-w-0 space-y-4 xl:col-start-1 xl:row-start-1">
              {selected && <XCreatorProfile creator={selected} />}
              <form
                noValidate
                className="flex flex-wrap items-center gap-2 border-b border-border pb-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = draftTicker
                    .trim()
                    .replace(/^\$/, "")
                    .toUpperCase();
                  if (value && !/^[A-Z][A-Z0-9.\-]{0,14}$/.test(value)) {
                    setFilterError(
                      c(
                        "Enter a valid stock ticker.",
                        "请输入有效的股票代码。",
                      ),
                    );
                    tickerRef.current?.focus();
                    return;
                  }
                  setFilterError("");
                  router.push(href({ ticker: value }));
                }}
              >
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <label htmlFor="x-ticker" className="sr-only">
                    {c("Stock ticker", "股票代码")}
                  </label>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    className="h-10 rounded-full pl-10 text-base sm:text-sm"
                    ref={tickerRef}
                    id="x-ticker"
                    value={draftTicker}
                    onChange={(e) => {
                      setDraftTicker(e.target.value);
                      setFilterError("");
                    }}
                    placeholder={c("Search stock ticker", "搜索股票代码")}
                    maxLength={16}
                    aria-invalid={!!filterError}
                    aria-describedby={
                      filterError ? "x-ticker-error" : undefined
                    }
                  />
                </div>
                <Button type="submit" variant="outline">
                  {c("Filter", "筛选")}
                </Button>
                {draftTicker && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDraftTicker("");
                      setFilterError("");
                      router.push(href({ ticker: "" }));
                      tickerRef.current?.focus();
                    }}
                  >
                    {c("Clear", "清除")}
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" disabled={loading} aria-label={c("Refresh posts", "刷新推文")} className="ml-auto" onClick={() => setRevision(value => value + 1)}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" /></Button>
                {filterError && (
                  <p
                    id="x-ticker-error"
                    role="alert"
                    className="w-full text-sm text-destructive"
                  >
                    {filterError}
                  </p>
                )}
              </form>
              <div aria-live="polite" aria-busy={loading}>
                {loading && (
                  <p
                    role="status"
                    className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
                  >
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    {c("Loading posts…", "正在加载推文…")}
                  </p>
                )}
                {error && (
                  <div
                    role="alert"
                    className="rounded-3xl border border-border p-6"
                  >
                    <p className="text-sm">{error}</p>
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => setRevision((value) => value + 1)}
                    >
                      {c("Retry", "重试")}
                    </Button>
                  </div>
                )}
                {feed && (
                  <p className="mb-4 text-xs text-muted-foreground">
                    {c(
                      `${format.format(feed.total)} posts`,
                      `共 ${format.format(feed.total)} 条推文`,
                    )}
                  </p>
                )}
                {feed?.posts.length === 0 && (
                  <div className="rounded-3xl border border-border p-8 text-center">
                    <h2 className="text-base font-semibold">
                      {c("No posts yet", "暂无推文")}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {author || ticker
                        ? c(
                            "Try another creator or clear the stock filter.",
                            "试试其他博主，或清除股票筛选。",
                          )
                        : c(
                            "Posts will appear here once creators have been added and synced.",
                            "添加博主并同步后，推文将显示在这里。",
                          )}
                    </p>
                    {(author || ticker || page > 1) && (
                      <Button variant="outline" asChild className="mt-4">
                        <Link href="/dashboard/x-opinions">
                          {c("Reset filters", "重置筛选")}
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
                <div key={`${author}:${ticker}:${page}:${revision}`} className="opinion-results divide-y divide-border">
                  {feed?.posts.map((post, index) => (
                    <article
                      key={post.id}
                      className="opinion-result-row min-w-0 py-6 first:pt-2"
                      style={{ animationDelay: `${Math.min(index, 6) * 20}ms` }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <CreatorAvatar creator={post.creator} username={post.author_username} />
                          <div className="min-w-0">
                          <Link
                            className={`${focusClass} text-sm font-semibold hover:underline`}
                            href={href({ author: post.author_username })}
                          >
                            {post.creator?.display_name || post.author_username}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            @{post.author_username} ·{" "}
                            <time dateTime={post.published_at}>
                              {new Intl.DateTimeFormat(
                                locale === "zh" ? "zh-CN" : "en-US",
                                { dateStyle: "medium", timeStyle: "short" },
                              ).format(new Date(post.published_at))}
                            </time>
                          </p>
                          </div>
                        </div>
                        <a
                          className={`${focusClass} inline-flex min-h-9 items-center gap-1 text-xs underline-offset-4 hover:underline`}
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {c("View on X", "查看原帖")}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      </div>
                      <div className="mt-4"><XTranslatedText text={post.text} quotes={post.quoted_texts} /></div>
                      {post.truncated && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {c(
                            "Incomplete text. Read the full post on X.",
                            "正文不完整，请前往 X 阅读全文。",
                          )}
                        </p>
                      )}
                      {post.cashtags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {post.cashtags.map((tag) => (
                            <StockBadge
                              key={tag}
                              symbol={tag}
                              href={href({ ticker: tag })}
                            />
                          ))}
                        </div>
                      )}
                      {post.media_links.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-3">
                          {post.media_links.map((link, index) => (
                            <a
                              key={`${link}-${index}`}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${focusClass} py-2 text-xs underline underline-offset-4`}
                            >
                              {c(
                                `Media ${index + 1} on X`,
                                `在 X 查看媒体 ${index + 1}`,
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                      <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        {Object.entries(metrics).map(
                          ([key, label]) =>
                            post.metrics[key] != null && (
                              <div key={key} className="flex gap-1">
                                <dt>{label}</dt>
                                <dd className="tabular-nums">
                                  {format.format(post.metrics[key]!)}
                                </dd>
                              </div>
                            ),
                        )}
                      </dl>
                    </article>
                  ))}
                </div>
              </div>
              {feed && feed.total > 20 && (
                <nav
                  aria-label={c("Post pages", "推文分页")}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => router.push(href({ page: page - 1 }))}
                  >
                    {c("Previous", "上一页")}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {page} / {Math.ceil(feed.total / 20)}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page * 20 >= feed.total}
                    onClick={() => router.push(href({ page: page + 1 }))}
                  >
                    {c("Next", "下一页")}
                  </Button>
                </nav>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                {c(
                  "Posts reflect their original publication times. Engagement counts are collection-time snapshots; missing counts are not zero. Images and charts are linked, not analyzed. Stock mentions do not imply an investment recommendation.",
                  "推文保留原始发布时间。互动数为采集时快照，未提供的数值不视为零。图片与图表仅链接展示，未作分析。股票提及不代表投资建议。",
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
