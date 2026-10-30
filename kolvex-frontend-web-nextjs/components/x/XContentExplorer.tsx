"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <DashboardLayout title={c("X creator posts", "X 博主内容")}>
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
        <h1 className="sr-only">{c("X creator posts", "X 博主内容")}</h1>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="min-w-0">
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
                    <span className="block break-words">
                      {creator.display_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      @{creator.username}
                    </span>
                  </Link>
                ))}
              </nav>
            </aside>
            <div className="min-w-0 space-y-4">
              {selected && (
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">
                    {selected.display_name}
                  </h2>
                  {selected.bio && (
                    <p className="break-words text-sm leading-6 text-muted-foreground">
                      {selected.bio}
                    </p>
                  )}
                  <a
                    className={`${focusClass} inline-flex min-h-9 items-center gap-1 text-sm underline underline-offset-4`}
                    href={`https://x.com/${selected.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{selected.username}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </div>
              )}
              <form
                noValidate
                className="flex flex-wrap items-end gap-2"
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
                <div className="min-w-0 flex-1">
                  <label htmlFor="x-ticker" className="mb-2 block text-sm">
                    {c("Stock ticker", "股票代码")}
                  </label>
                  <Input
                    ref={tickerRef}
                    id="x-ticker"
                    value={draftTicker}
                    onChange={(e) => {
                      setDraftTicker(e.target.value);
                      setFilterError("");
                    }}
                    placeholder="TSLA"
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
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {c("Loading posts…", "正在加载推文…")}
                  </p>
                )}
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-border p-6"
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
                  <div className="rounded-xl border border-border p-8 text-center">
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
                            "An administrator can add creators and import their posts above.",
                            "管理员可在上方添加博主并导入推文。",
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
                <div className="space-y-4">
                  {feed?.posts.map((post) => (
                    <article
                      key={post.id}
                      className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
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
                      <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7 [overflow-wrap:anywhere]">
                        {post.text}
                      </p>
                      {post.truncated && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {c(
                            "Incomplete text. Read the full post on X.",
                            "正文不完整，请前往 X 阅读全文。",
                          )}
                        </p>
                      )}
                      {post.quoted_texts.map((quote, index) => (
                        <blockquote
                          key={index}
                          className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-sm leading-6 [overflow-wrap:anywhere]"
                        >
                          {quote}
                        </blockquote>
                      ))}
                      {post.cashtags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {post.cashtags.map((tag) => (
                            <Link
                              key={tag}
                              href={href({ ticker: tag })}
                              className={`${focusClass} bg-muted px-2 py-1 text-xs font-semibold`}
                            >
                              ${tag}
                            </Link>
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
