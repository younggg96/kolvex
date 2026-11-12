"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchFieldIcon } from "@/components/ui/search-input";
import {
  ListCard,
  ListRows,
  listFeedRowClass,
} from "@/components/ui/list-card";
import StockBadge from "@/components/ui/stock-badge";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { marketStockHref } from "@/lib/stockLinks";
import { xRequest, type XCreator, type XFeed } from "@/lib/xContentApi";
import XCreatorProfile, { CreatorAvatar } from "./XCreatorProfile";
import XCreatorSummaries from "./XCreatorSummaries";
import XTranslatedText from "./XTranslatedText";

type Location = {
  author?: string;
  ticker?: string;
  page?: number;
};
type Copy = (en: string, zh: string) => string;
const PAGE_SIZE = 20;
const focusClass =
  "rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

export default function XContentExplorer() {
  const { locale } = useTranslation();
  const c: Copy = (en, zh) => (locale === "zh" ? zh : en);
  const router = useRouter();
  const params = useSearchParams();
  const author = params.get("author") || "";
  const ticker = params.get("ticker") || "";
  const rawPage = Number(params.get("page") || "1");
  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 5001
      ? rawPage
      : 1;
  const [creators, setCreators] = useState<XCreator[] | null>(null);
  const [creatorError, setCreatorError] = useState(false);
  const [creatorAttempt, setCreatorAttempt] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    let active = true;
    setCreatorError(false);
    void xRequest<{ creators: XCreator[] }>("creators", {
      signal: controller.signal,
    })
      .then((data) => {
        if (active) setCreators(data.creators);
      })
      .catch(() => {
        if (active) setCreatorError(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [creatorAttempt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [author, ticker, page]);

  function href(values: Location) {
    const next = new URLSearchParams();
    const nextAuthor = values.author ?? author;
    const nextTicker = values.ticker ?? ticker;
    if (nextAuthor) next.set("author", nextAuthor);
    if (nextTicker) next.set("ticker", nextTicker);
    if ((values.page ?? 1) > 1) next.set("page", String(values.page));
    return `/dashboard/x-opinions${next.size ? `?${next}` : ""}`;
  }

  const selected = creators?.find((creator) => creator.username === author);
  const title = c("X Opinions", "X 博主观点");
  return (
    <DashboardLayout title={title}>
      <div
        ref={scrollRef}
        data-nav-underlay
        className="min-h-0 flex-1 overflow-y-auto bg-background px-4 pb-10 pt-4 md:px-8 md:pt-8 dark:bg-transparent"
      >
        <div className="mx-auto w-full max-w-[1440px] space-y-6">
          <header className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {title}
              </h1>
            </div>
            <a href="#x-posts-heading" className={cn(focusClass, "inline-flex min-h-10 items-center text-sm text-muted-foreground underline underline-offset-4 xl:hidden")}>
              {c("Jump to original posts", "跳到原始推文")}
            </a>
          </header>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
            <aside
              aria-labelledby="x-summary-heading"
              className="order-1 min-w-0 xl:order-2"
            >
              <XCreatorSummaries
                author={author}
                creators={creators}
                creatorError={creatorError}
                retryCreators={() => setCreatorAttempt((value) => value + 1)}
                creatorPostsHref={(username) => href({ author: username })}
              />
            </aside>
            <div className="order-2 min-w-0 space-y-4 xl:order-1">
              {selected && (
                <details key={author} className="group">
                  <summary
                    className={cn(
                      focusClass,
                      "flex min-h-10 w-fit cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden",
                    )}
                  >
                    {c("Creator profile", "博主资料")}
                    <ChevronDown
                      className="h-4 w-4 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="pt-2">
                    <XCreatorProfile creator={selected} />
                  </div>
                </details>
              )}
              <XPosts {...{ author, ticker, page, href, c, locale }} />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function XPosts({
  author,
  ticker,
  page,
  href,
  c,
  locale,
}: {
  author: string;
  ticker: string;
  page: number;
  href: (values: Location) => string;
  c: Copy;
  locale: string;
}) {
  const router = useRouter();
  const scope = JSON.stringify([author, ticker, page]);
  const [result, setResult] = useState<{
    scope: string;
    feed?: XFeed;
    status: "loading" | "ready" | "error";
  }>();
  const current = result?.scope === scope ? result : undefined;
  const feed = current?.feed;
  const loading = !current || current.status === "loading";
  const error = current?.status === "error";
  const [revision, setRevision] = useState(0);
  const [draftTicker, setDraftTicker] = useState(ticker);
  const [filterError, setFilterError] = useState(false);
  const tickerRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setDraftTicker(ticker);
    setFilterError(false);
  }, [ticker]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    let active = true;
    setResult((previous) => ({
      scope,
      feed: previous?.scope === scope ? previous.feed : undefined,
      status: "loading",
    }));
    const query = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (author) query.set("author", author);
    if (ticker) query.set("ticker", ticker);
    void xRequest<XFeed>(`posts?${query}`, { signal: controller.signal })
      .then((result) => {
        if (active) setResult({ scope, feed: result, status: "ready" });
      })
      .catch(() => {
        if (active)
          setResult((previous) => ({
            scope,
            feed: previous?.feed,
            status: "error",
          }));
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [author, ticker, page, revision, scope]);

  const format = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US");
  const postDate = new Intl.DateTimeFormat(
    locale === "zh" ? "zh-CN" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  );
  const metrics: Record<string, string> = {
    replies: c("Replies", "回复"),
    reposts: c("Reposts", "转发"),
    likes: c("Likes", "点赞"),
    bookmarks: c("Bookmarks", "收藏"),
    views: c("Views", "浏览"),
  };
  const refresh = () => setRevision((value) => value + 1);
  const pageCount = Math.ceil((feed?.total ?? 0) / PAGE_SIZE);

  return (
    <section aria-labelledby="x-posts-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          id="x-posts-heading"
          className="text-xl font-semibold"
        >
          {c("Original posts", "原始推文")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={loading}
          aria-label={c("Refresh posts", "刷新推文")}
          title={c("Refresh posts", "刷新推文")}
          onClick={refresh}
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              loading && "animate-spin motion-reduce:animate-none",
            )}
            aria-hidden="true"
          />
        </Button>
      </div>
      <ListCard>
        <form
          noValidate
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (composing.current) return;
            const value = draftTicker.trim().replace(/^\$/, "").toUpperCase();
            if (value && !/^[A-Z][A-Z0-9.\-]{0,14}$/.test(value)) {
              setFilterError(true);
              tickerRef.current?.focus();
              return;
            }
            setDraftTicker(value);
            setFilterError(false);
            router.push(href({ ticker: value }), { scroll: false });
          }}
        >
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="x-ticker" className="sr-only">
              {c("Stock ticker", "股票代码")}
            </label>
            <SearchFieldIcon />
            <Input
              ref={tickerRef}
              id="x-ticker"
              className="h-10 pl-10 pr-12 text-sm"
              value={draftTicker}
              maxLength={16}
              autoComplete="off"
              spellCheck={false}
              placeholder={c("Stock ticker, e.g. NVDA", "股票代码，例如 NVDA")}
              aria-invalid={filterError}
              aria-describedby={filterError ? "x-ticker-error" : undefined}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.nativeEvent.isComposing || composing.current)
                )
                  event.preventDefault();
              }}
              onChange={(event) => {
                setDraftTicker(event.target.value);
                setFilterError(false);
              }}
            />
            {(draftTicker || ticker) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 z-10 my-auto h-10 w-10"
                aria-label={c("Clear ticker", "清除股票代码")}
                title={c("Clear ticker", "清除股票代码")}
                onClick={() => {
                  setDraftTicker("");
                  setFilterError(false);
                  if (ticker)
                    router.push(href({ ticker: "" }), { scroll: false });
                  tickerRef.current?.focus();
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          <Button type="submit" variant="outline">
            {c("Search", "搜索")}
          </Button>
          {filterError && (
            <p
              id="x-ticker-error"
              role="alert"
              className="w-full text-sm text-destructive"
            >
              {c("Enter a valid stock ticker.", "请输入有效的股票代码。")}
            </p>
          )}
        </form>

        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 py-4"
          >
            <p className="text-sm text-muted-foreground">
              {feed
                ? c(
                    "Refresh failed. Showing the last loaded posts.",
                    "刷新失败，仍显示上次加载的推文。",
                  )
                : c("Could not load posts.", "暂时无法加载推文。")}
            </p>
            <Button variant="outline" size="sm" onClick={refresh}>
              {c("Retry", "重试")}
            </Button>
          </div>
        )}
        <p
          role="status"
          className="mt-4 flex min-h-5 items-center gap-2 text-xs tabular-nums text-muted-foreground"
        >
          {loading && !feed && (
            <>
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {c("Loading posts…", "正在加载推文…")}
            </>
          )}
          {feed &&
            (ticker ? `${ticker} · ` : "") +
              c(
                `${format.format(feed.total)} posts`,
                `共 ${format.format(feed.total)} 条推文`,
              )}
        </p>
        {feed?.posts.length === 0 && (
          <div className="space-y-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {author || ticker
                ? c("No posts match these filters.", "没有符合筛选条件的推文。")
                : c("No posts on this page.", "此页暂无推文。")}
            </p>
            {(author || ticker || page > 1) && (
              <Button variant="outline" asChild>
                <Link href={href({ author: "", ticker: "", page: 1 })}>
                  {c("Reset filters", "重置筛选")}
                </Link>
              </Button>
            )}
          </div>
        )}
        {!!feed?.posts.length && (
          <div className="opinion-results" aria-busy={loading}>
            <ListRows aria-label={c("Posts", "推文")}>
              {feed?.posts.map((post, index) => (
                <li
                  key={post.id}
                  className={cn(
                    "opinion-result-row",
                    listFeedRowClass,
                    "rounded-2xl px-2 transition-colors hover:bg-foreground/[0.06] focus-within:bg-foreground/[0.06] motion-reduce:transition-none",
                  )}
                  style={{ animationDelay: `${Math.min(index, 6) * 20}ms` }}
                >
                  <article className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <CreatorAvatar
                          creator={post.creator}
                          username={post.author_username}
                        />
                        <div className="min-w-0">
                          <Link
                            className={`${focusClass} text-sm font-semibold hover:underline`}
                            href={href({
                              author: post.author_username,
                            })}
                          >
                            {post.creator?.display_name || post.author_username}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            @{post.author_username} ·{" "}
                            <time dateTime={post.published_at}>
                              {postDate.format(new Date(post.published_at))}
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
                    <div className="mt-4">
                      <XTranslatedText
                        text={post.text}
                        quotes={post.quoted_texts}
                      />
                    </div>
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
                        {post.cashtags.map((tag) => {
                          // One chip, one destination: the stock identity itself is the
                          // link to that stock's quotes page. Tapping it must not be
                          // ambiguous, so no separate "filter by this ticker" action
                          // sits beside it (filtering also means server round-trips and
                          // would strand the user away from the quotes page).
                          const quotesHref = marketStockHref(tag);
                          const isActiveFilter =
                            !!ticker &&
                            ticker.toUpperCase() === tag.toUpperCase();
                          return (
                            <Link
                              key={tag}
                              href={quotesHref}
                              aria-label={c(`Open ${tag} quotes`, `打开 ${tag} 行情`)}
                              className={cn(
                                focusClass,
                                "inline-flex hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground",
                                isActiveFilter &&
                                  "border-foreground/40 text-foreground",
                              )}
                            >
                              <StockBadge symbol={tag} href={null} />
                            </Link>
                          );
                        })}
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
                </li>
              ))}
            </ListRows>
          </div>
        )}
        {feed && pageCount > 1 && (
          <nav
            aria-label={c("Post pages", "推文分页")}
            className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-4"
          >
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => {
                headingRef.current?.focus();
                router.push(href({ page: Math.min(page - 1, pageCount) }), {
                  scroll: false,
                });
              }}
            >
              {c("Previous", "上一页")}
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => {
                headingRef.current?.focus();
                router.push(href({ page: page + 1 }), { scroll: false });
              }}
            >
              {c("Next", "下一页")}
            </Button>
          </nav>
        )}
      </ListCard>
      <p className="text-xs leading-5 text-muted-foreground">
        {c(
          "Engagement counts reflect when posts were collected. Images and charts are available through their source links.",
          "互动数为采集时的记录，图片和图表可通过原帖链接查看。",
        )}
      </p>
    </section>
  );
}
