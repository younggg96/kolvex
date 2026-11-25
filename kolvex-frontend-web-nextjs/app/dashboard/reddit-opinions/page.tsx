"use client";

import Link from "next/link";
import { ContentLoading, SkeletonRepeat } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ExternalLink, Loader2, RefreshCw, Star, X } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchFieldIcon } from "@/components/ui/search-input";
import { CommandSearch } from "@/components/ui/command-search";
import { InfoTip } from "@/components/ui/info-tip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterSheet, FilterSheetGroup, FilterSheetToggle } from "@/components/ui/filter-sheet";
import WatchlistButton from "@/components/decision/WatchlistButton";
import CompanyLogo, { phoneListLogoClass } from "@/components/ui/company-logo";
import { ListCard, ListRow, listRowTargetClass } from "@/components/ui/list-card";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useRedditWatchlist } from "@/hooks/useRedditWatchlist";
import { marketStockHref } from "@/lib/stockLinks";
import {
  REDDIT_COMMUNITIES,
  mentionChange,
  selectRedditStocks,
  type RedditCommunity,
  type RedditRanking,
  type RedditSort,
  type RedditStock,
} from "@/lib/redditOpinions";
import { withSign } from "@/lib/format";

// Same column rhythm as the YouTube opinions stock rows: identity, then two
// stat columns that keep fixed widths from sm up. From md the trend sits
// centred in its own column and the rank/upvotes column is left-aligned, so the
// sparkline has the same gap on both sides however short the rank label is.
const ROW_GRID =
  "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:gap-x-4 md:grid-cols-[minmax(0,1fr)_112px_152px_120px]";
const STOCK_IDENTITY = "flex min-w-0 items-center gap-3";
const STOCK_TICKER = "block text-[0.9375rem] font-semibold";
const STOCK_NAME = "mt-0.5 block text-[0.8125rem] text-muted-foreground";

/** Relative 30-day mention shape; decorative next to the row's own numbers. */
function TrendSparkline({ points }: { points: number[] }) {
  const width = 120;
  const height = 32;
  const step = width / (points.length - 1);
  const line = points
    .map(
      (value, index) =>
        `${(index * step).toFixed(1)},${(2 + (1 - value) * (height - 4)).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="mx-auto block bg-background text-primary"
      aria-hidden="true"
    >
      <polygon
        points={`0,${height} ${line} ${width},${height}`}
        fill="currentColor"
        opacity="0.14"
      />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function RedditOpinionsPage() {
  const { t, locale } = useTranslation();
  const [community, setCommunity] = useState<RedditCommunity>("all-stocks");
  const [sort, setSort] = useState<RedditSort>("mentions");
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const { watchlist, ready } = useRedditWatchlist();
  const { data, loading, refreshing, error, refresh } = useCachedResource<RedditRanking>(
    `reddit:ranking:${community}`,
    async (signal) => {
      const response = await fetch(`/api/reddit-opinions?community=${community}`, {
        signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Ranking unavailable");
      const ranking: RedditRanking = await response.json();
      if (ranking.community !== community) throw new Error("Ranking community mismatch");
      return ranking;
    },
    { ttl: 300_000, maxAge: 3_600_000, timeout: 20_000 },
  );
  const busy = loading || refreshing;

  const number = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US");
  const rows = useMemo(
    () =>
      selectRedditStocks(data?.results ?? [], query, sort, onlyWatchlist ? watchlist : undefined),
    [data, query, sort, onlyWatchlist, watchlist],
  );

  const changeLabel = (row: RedditStock) => {
    const change = mentionChange(row);
    const rounded = change === null ? null : Math.round(change);
    return rounded === null
      ? "—"
      : withSign(rounded, (magnitude) => `${number.format(magnitude)}%`);
  };
  const rankLabel = (row: RedditStock) => {
    if (row.previousRank === null) return t("redditOpinions.new");
    const change = row.previousRank - row.rank;
    return change > 0
      ? t("redditOpinions.rankUp", { count: String(change) })
      : change < 0
        ? t("redditOpinions.rankDown", { count: String(-change) })
        : t("redditOpinions.unchanged");
  };
  const fullFetchTime = data
    ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.fetchedAt))
    : "";
  const communityLabel = (value: RedditCommunity) =>
    value === "all-stocks" ? t("redditOpinions.allCommunities") : `r/${value}`;
  const sortOptions = (["mentions", "mentionChange", "rankChange", "upvotes"] as const).map(
    (value) => ({ value, label: t(`redditOpinions.sortOptions.${value}`) }),
  );
  const filtered = community !== "all-stocks" || sort !== "mentions" || onlyWatchlist;
  const resetFilters = () => {
    setCommunity("all-stocks");
    setSort("mentions");
    setOnlyWatchlist(false);
  };
  const watchButton = (row: RedditStock, compact = false) => (
    <WatchlistButton ticker={row.ticker} showLabel={!compact} />
  );

  // Headers align like the values under them. In a right-aligned column the
  // sort arrow leads the label so the text ends on the column edge; in the
  // left-aligned rank column it trails so the text starts on the edge.
  const sortButton = (value: RedditSort, label: string, align: "end" | "start" = "end") => (
    <button
      type="button"
      onClick={() => setSort(value)}
      aria-pressed={sort === value}
      title={t(`redditOpinions.sortOptions.${value}`)}
      className={cn(
        "list-control inline-flex min-h-6 items-center gap-0.5 whitespace-nowrap rounded-full px-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary",
        sort === value && "font-medium text-foreground",
      )}
    >
      {align === "end" && sort === value && <ArrowDown className="h-3 w-3" aria-hidden="true" />}
      {label}
      {align === "start" && sort === value && <ArrowDown className="h-3 w-3" aria-hidden="true" />}
    </button>
  );

  const resultCount = t("redditOpinions.resultCount", {
    count: number.format(rows.length),
    total: number.format(data?.results.length ?? 0),
  });

  return (
    <DashboardLayout title={t("redditOpinions.header")}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[100rem] px-[16px] pb-6 pt-[12px] md:px-8 md:py-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight md:text-[2rem]">
              {t("redditOpinions.title")}
              <InfoTip label={t("redditOpinions.dataNotes")}>
                <p>{t("redditOpinions.scopeNote", { community: communityLabel(community) })}</p>
                {data && <p className="tabular-nums">{resultCount}</p>}
                {onlyWatchlist && <p className="mt-1">{t("redditOpinions.watchlistNote")}</p>}
              </InfoTip>
            </h1>
            <div className="flex shrink-0 items-center gap-1">
              <FilterSheet
                title={t("common.filter")}
                active={filtered}
                onReset={resetFilters}
                summary={[
                  communityLabel(community),
                  sortOptions.find((option) => option.value === sort)?.label,
                  onlyWatchlist && t("redditOpinions.onlyWatchlist"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <FilterSheetGroup
                  label={t("redditOpinions.community")}
                  value={community}
                  onChange={setCommunity}
                  options={REDDIT_COMMUNITIES.map((value) => ({
                    value,
                    label: communityLabel(value),
                  }))}
                />
                <FilterSheetGroup
                  label={t("redditOpinions.sort")}
                  value={sort}
                  onChange={setSort}
                  options={sortOptions}
                />
                <FilterSheetToggle
                  label={t("redditOpinions.scope")}
                  pressed={onlyWatchlist}
                  onChange={setOnlyWatchlist}
                  disabled={!ready}
                >
                  <Star
                    className={cn("h-4 w-4", onlyWatchlist && "fill-current")}
                    aria-hidden="true"
                  />
                  {t("redditOpinions.onlyWatchlist")}{" "}
                  <span className="tabular-nums">{watchlist.length}</span>
                </FilterSheetToggle>
              </FilterSheet>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={refresh}
                disabled={busy}
                aria-label={t("redditOpinions.refresh")}
                title={t("redditOpinions.refresh")}
              >
                {busy ? (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          <section aria-label={t("redditOpinions.title")} className="mt-3 md:mt-4">
            <ListCard>
              <div className="hidden items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_12rem_auto]">
                <CommandSearch hasValue={!!query} shortcut="mod+k">
                  <div className="relative">
                    <SearchFieldIcon />
                    <Input
                      ref={searchInput}
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t("redditOpinions.search")}
                      aria-label={t("redditOpinions.search")}
                      className="h-11 pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {query && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-11 w-11"
                        aria-label={t("redditOpinions.clearSearch")}
                        title={t("redditOpinions.clearSearch")}
                        onClick={() => {
                          setQuery("");
                          searchInput.current?.focus();
                        }}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </CommandSearch>
                <div className="min-w-0">
                  <Select
                    value={community}
                    onValueChange={(value) => setCommunity(value as RedditCommunity)}
                  >
                    <SelectTrigger aria-label={t("redditOpinions.community")} className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REDDIT_COMMUNITIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {communityLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  className={`justify-self-start !px-3.5 !font-normal ${onlyWatchlist ? "" : "!bg-muted hover:!bg-foreground/[0.04]"}`}
                  aria-pressed={onlyWatchlist}
                  disabled={!ready}
                  onClick={() => setOnlyWatchlist((value) => !value)}
                >
                  <Star
                    className={`h-4 w-4 ${onlyWatchlist ? "fill-current" : ""}`}
                    aria-hidden="true"
                  />
                  {t("redditOpinions.onlyWatchlist")}{" "}
                  <span className="tabular-nums">{watchlist.length}</span>
                </Button>
              </div>
              {data && (
                <p role="status" aria-live="polite" className="sr-only">
                  {resultCount}
                </p>
              )}

              {Boolean(error) && (
                <div
                  role="alert"
                  className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm"
                >
                  <p>{t(data ? "redditOpinions.staleError" : "redditOpinions.error")}</p>
                  <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
                    {t("redditOpinions.retry")}
                  </Button>
                </div>
              )}

              {/* Mirrors ListRow geometry (gap-3, pr-2, 36px icon button) so each
                  label sits over its column. Each stat cell stacks two lines
                  (mentions over change, rank over upvotes), so its two sort
                  labels stack the same way; -mr-2 / -ml-2 cancel the buttons' own
                  px-2 so label text meets the column edge like the values. */}
              <div className="mt-3 hidden items-center gap-3 border-b border-border pb-1 pr-2 text-xs text-muted-foreground lg:flex">
                <div className={cn(ROW_GRID, "px-2")}>
                  <span className="pl-8">{t("redditOpinions.stock")}</span>
                  <span className="-mr-2 flex flex-col items-end">
                    {sortButton("mentions", t("redditOpinions.mentionsUnit"))}
                    {sortButton("mentionChange", t("redditOpinions.changeShort"))}
                  </span>
                  <span className="text-center">{t("redditOpinions.trend")}</span>
                  <span className="-ml-2 flex flex-col items-start">
                    {sortButton("rankChange", t("redditOpinions.rankShort"), "start")}
                    {sortButton("upvotes", t("redditOpinions.upvotesShort"), "start")}
                  </span>
                </div>
                <span className="w-9 shrink-0" aria-hidden="true" />
              </div>

              <div
                key={`${community}:${sort}:${query}:${onlyWatchlist}:${data?.fetchedAt ?? "loading"}`}
                aria-busy={busy}
                className="opinion-results mt-3 lg:mt-1"
              >
                {loading && !data ? (
                  <ContentLoading label={t("redditOpinions.loading")} className="min-h-0">
                    <SkeletonRepeat count={8}>
                      {(i) => (
                        <div className={cn(ROW_GRID, "min-h-16 py-2 pl-2 pr-12 max-md:pl-0")}>
                          <span className={STOCK_IDENTITY}>
                            <Skeleton className="h-3 w-4 shrink-0 rounded" />
                            <Skeleton className="h-8 w-8 shrink-0 rounded-full md:h-10 md:w-10" />
                            <span className="flex min-w-0 flex-1 flex-col gap-2">
                              <Skeleton className="h-4 w-12 rounded-md" />
                              <Skeleton className={cn("h-3 rounded-md", i % 2 ? "w-20" : "w-28")} />
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-2">
                            <Skeleton className="h-4 w-10 rounded-md" />
                            <Skeleton className="h-3 w-16 rounded-md" />
                          </span>
                          <Skeleton className="mx-auto hidden h-8 w-[120px] rounded-md md:block" />
                          <span className="flex flex-col items-end gap-2 md:items-start">
                            <Skeleton className="h-4 w-12 rounded-md" />
                            <Skeleton className="h-3 w-14 rounded-md" />
                          </span>
                        </div>
                      )}
                    </SkeletonRepeat>
                  </ContentLoading>
                ) : data && rows.length > 0 ? (
                  /* Ordered list: ranks are meaningful. Rows share the stock-row
                     shape of the YouTube opinions directory (ListRow + row target). */
                  <ol aria-label={t("redditOpinions.title")} className="min-w-0">
                    {rows.map((row) => {
                      const change = changeLabel(row);
                      return (
                        <ListRow key={row.ticker} className="opinion-result-row">
                          <Link
                            href={marketStockHref(row.ticker)}
                            aria-label={t("redditOpinions.openStock", { ticker: row.ticker })}
                            className={cn(ROW_GRID, listRowTargetClass, "group min-h-0")}
                          >
                            <span className={STOCK_IDENTITY}>
                              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                                <span className="sr-only">{t("redditOpinions.rank")} </span>
                                {row.rank}
                              </span>
                              <span aria-hidden="true" className="shrink-0">
                                <CompanyLogo
                                  symbol={row.ticker}
                                  name={row.name}
                                  size="md"
                                  className={phoneListLogoClass}
                                />
                              </span>
                              <span className="min-w-0">
                                <span className={STOCK_TICKER}>{row.ticker}</span>
                                <span className={cn(STOCK_NAME, "truncate")} title={row.name}>
                                  {row.name}
                                </span>
                              </span>
                            </span>
                            <span className="text-right tabular-nums">
                              <span className="block text-[0.9375rem] font-semibold">
                                {number.format(row.mentions)}
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  {t("redditOpinions.mentionsUnit")}
                                </span>
                              </span>
                              <span
                                className="mt-0.5 block whitespace-nowrap text-xs text-muted-foreground"
                                title={
                                  mentionChange(row) === null
                                    ? t("redditOpinions.noBaseline")
                                    : undefined
                                }
                              >
                                <span className="max-sm:sr-only">
                                  {t("redditOpinions.changeShort")}{" "}
                                </span>
                                <span className="font-medium text-foreground">{change}</span>
                              </span>
                            </span>
                            <span className="hidden md:block">
                              <span className="sr-only">{t("redditOpinions.trend")} </span>
                              {row.trend ? (
                                <TrendSparkline points={row.trend} />
                              ) : (
                                <span className="block text-center text-xs text-muted-foreground">
                                  —<span className="sr-only">{t("redditOpinions.noTrend")}</span>
                                </span>
                              )}
                            </span>
                            <span className="text-right tabular-nums md:text-left">
                              <span className="block whitespace-nowrap text-sm font-medium">
                                <span className="sr-only">{t("redditOpinions.rankChange")} </span>
                                {rankLabel(row)}
                              </span>
                              <span className="mt-0.5 block whitespace-nowrap text-xs text-muted-foreground">
                                {t("redditOpinions.upvotesCount", {
                                  count: number.format(row.upvotes),
                                })}
                              </span>
                            </span>
                          </Link>
                          <span className="shrink-0">{watchButton(row, true)}</span>
                        </ListRow>
                      );
                    })}
                  </ol>
                ) : (
                  data && (
                    <div role="status" className="py-12 text-center text-sm text-muted-foreground">
                      <p>
                        {t(
                          data.results.length === 0
                            ? "redditOpinions.empty"
                            : onlyWatchlist
                              ? watchlist.length === 0
                                ? "redditOpinions.watchlistEmpty"
                                : "redditOpinions.watchlistNoResults"
                              : "redditOpinions.noResults",
                        )}
                      </p>
                      {(query || onlyWatchlist) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            setQuery("");
                            setOnlyWatchlist(false);
                          }}
                        >
                          {t("redditOpinions.clearFilters")}
                        </Button>
                      )}
                    </div>
                  )
                )}
              </div>
            </ListCard>
          </section>

          <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">
            <a
              href="https://apewisdom.io/methodology/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("redditOpinions.source")}
              className="inline-flex min-h-9 items-center gap-1 underline-offset-4 hover:underline focus-visible:outline-none "
            >
              ApeWisdom <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            {data && (
              <time
                dateTime={data.fetchedAt}
                title={`${t("redditOpinions.fetchedAt")} ${fullFetchTime}`}
                aria-label={`${t("redditOpinions.fetchedAt")} ${fullFetchTime}`}
              >
                {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(data.fetchedAt))}
              </time>
            )}
          </footer>
          <details className="mt-2 text-xs leading-5 text-muted-foreground">
            <summary className="w-fit cursor-pointer rounded-sm py-1 underline-offset-4 hover:underline focus-visible:outline-none ">
              {t("redditOpinions.dataNotes")}
            </summary>
            <p className="mt-2 max-w-prose">{t("redditOpinions.note")}</p>
          </details>
        </div>
      </div>
    </DashboardLayout>
  );
}
