"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Loader2, RefreshCw, Search, Star, X } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CompanyLogo from "@/components/ui/company-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useRedditWatchlist } from "@/hooks/useRedditWatchlist";
import { REDDIT_COMMUNITIES, mentionChange, selectRedditStocks, type RedditCommunity, type RedditRanking, type RedditSort, type RedditStock } from "@/lib/redditOpinions";

export default function RedditOpinionsPage() {
  const { t, locale } = useTranslation();
  const [community, setCommunity] = useState<RedditCommunity>("all-stocks");
  const [sort, setSort] = useState<RedditSort>("mentions");
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const { watchlist, ready, toggle, storageUnavailable } = useRedditWatchlist();
  const { data, loading, refreshing, error, refresh } = useCachedResource<RedditRanking>(
    `reddit:ranking:${community}`,
    async signal => {
      const response = await fetch(`/api/reddit-opinions?community=${community}`, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Ranking unavailable");
      const ranking: RedditRanking = await response.json();
      if (ranking.community !== community) throw new Error("Ranking community mismatch");
      return ranking;
    },
    { ttl: 300_000, maxAge: 3_600_000, timeout: 20_000 },
  );
  const busy = loading || refreshing;

  const number = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US");
  const rows = useMemo(() => selectRedditStocks(data?.results ?? [], query, sort, onlyWatchlist ? watchlist : undefined),
    [data, query, sort, onlyWatchlist, watchlist]);

  const changeLabel = (row: RedditStock) => {
    const change = mentionChange(row);
    const rounded = change === null ? null : Math.round(change);
    return rounded === null ? "—" : `${rounded > 0 ? "+" : ""}${number.format(rounded === 0 ? 0 : rounded)}%`;
  };
  const rankLabel = (row: RedditStock) => {
    if (row.previousRank === null) return t("redditOpinions.new");
    const change = row.previousRank - row.rank;
    return change > 0 ? t("redditOpinions.rankUp", { count: String(change) })
      : change < 0 ? t("redditOpinions.rankDown", { count: String(-change) })
      : t("redditOpinions.unchanged");
  };
  const fullFetchTime = data ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(data.fetchedAt)) : "";
  const communityLabel = (value: RedditCommunity) => value === "all-stocks" ? t("redditOpinions.allCommunities") : `r/${value}`;
  const watchButton = (row: RedditStock, compact = false) => {
    const saved = watchlist.includes(row.ticker);
    const label = t(saved ? "redditOpinions.unfollow" : "redditOpinions.follow", { ticker: row.ticker });
    return <Button variant="ghost" size={compact ? "icon" : "sm"} disabled={!ready} aria-pressed={saved}
      aria-label={label} title={label} onClick={() => toggle(row.ticker)} className={compact ? "h-10 w-10" : "-ml-3 mt-3"}>
      <Star className={`h-4 w-4 ${saved ? "fill-current" : "text-muted-foreground"}`} aria-hidden="true" />
      {!compact && <span>{t(saved ? "redditOpinions.following" : "redditOpinions.followAction")}</span>}
    </Button>;
  };

  return (
    <DashboardLayout title={t("redditOpinions.header")}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-4 md:px-8 md:py-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[32px]">{t("redditOpinions.title")}</h1>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={refresh} disabled={busy}
              aria-label={t("redditOpinions.refresh")} title={t("redditOpinions.refresh")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 items-end gap-3 md:mt-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]">
            <div className="relative col-span-2 md:col-span-3 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input ref={searchInput} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("redditOpinions.search")} aria-label={t("redditOpinions.search")} aria-describedby="reddit-scope" className="pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden" />
              {query && <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" aria-label={t("redditOpinions.clearSearch")} title={t("redditOpinions.clearSearch")}
                onClick={() => { setQuery(""); searchInput.current?.focus(); }}><X className="h-4 w-4" aria-hidden="true" /></Button>}
            </div>
            <div className="min-w-0">
              <label htmlFor="reddit-community" className="mb-1.5 block text-xs text-muted-foreground">{t("redditOpinions.community")}</label>
              <Select value={community} onValueChange={value => setCommunity(value as RedditCommunity)}>
                <SelectTrigger id="reddit-community"><SelectValue /></SelectTrigger>
                <SelectContent>{REDDIT_COMMUNITIES.map(value => <SelectItem key={value} value={value}>{communityLabel(value)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <label htmlFor="reddit-sort" className="mb-1.5 block text-xs text-muted-foreground">{t("redditOpinions.sort")}</label>
              <Select value={sort} onValueChange={value => setSort(value as RedditSort)}>
                <SelectTrigger id="reddit-sort"><SelectValue /></SelectTrigger>
                <SelectContent>{(["mentions", "mentionChange", "rankChange", "upvotes"] as const).map(value => <SelectItem key={value} value={value}>{t(`redditOpinions.sortOptions.${value}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant={onlyWatchlist ? "secondary" : "outline"} size="sm" className="col-span-2 h-10 justify-self-start md:col-span-1" aria-pressed={onlyWatchlist} disabled={!ready} onClick={() => setOnlyWatchlist(value => !value)}>
              <Star className={`h-4 w-4 ${onlyWatchlist ? "fill-current" : ""}`} aria-hidden="true" />
              {t("redditOpinions.onlyWatchlist")} <span className="tabular-nums">{watchlist.length}</span>
            </Button>
          </div>
          <div id="reddit-scope" className="mb-4 mt-3 flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">
            <p>{t("redditOpinions.scopeNote", { community: communityLabel(community) })}</p>
            {data && <p role="status" aria-live="polite">{t("redditOpinions.resultCount", { count: number.format(rows.length), total: number.format(data.results.length) })}</p>}
          </div>

          {onlyWatchlist && <p className="mb-4 text-xs leading-5 text-muted-foreground">{t("redditOpinions.watchlistNote")}</p>}
          {storageUnavailable && <p role="status" className="mb-4 text-sm text-muted-foreground">{t("redditOpinions.storageUnavailable")}</p>}

          {Boolean(error) && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm">
            <p>{t(data ? "redditOpinions.staleError" : "redditOpinions.error")}</p>
            <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>{t("redditOpinions.retry")}</Button>
          </div>}

          <div aria-busy={busy}>
            {loading && !data ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t("redditOpinions.loading")}</div>
              : data && rows.length > 0 ? <>
                <div className="md:hidden">
                  <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_1rem] items-center gap-2 border-b border-border pb-2 text-xs text-muted-foreground" aria-hidden="true">
                    <span>{t("redditOpinions.stock")}</span>
                    <span className="text-right">{t("redditOpinions.mobileMentions")}</span>
                  </div>
                  <ol aria-label={t("redditOpinions.title")} className="divide-y divide-border">
                    {rows.map((row) => <li key={row.ticker}>
                      <details className="group">
                        <summary className="grid min-h-20 cursor-pointer list-none grid-cols-[minmax(0,1fr)_5.5rem_1rem] items-center gap-2 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground"><span className="sr-only">{t("redditOpinions.rank")} </span>{row.rank}</span>
                            <span aria-hidden="true"><CompanyLogo symbol={row.ticker} name={row.name} size="sm" /></span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{row.ticker}</span>
                              <span className="mt-1 block truncate text-xs text-muted-foreground" title={row.name}>{row.name}</span>
                            </span>
                          </span>
                          <span className="text-right tabular-nums">
                            <span className="block text-sm font-semibold"><span className="sr-only">{t("redditOpinions.mentions")} </span>{number.format(row.mentions)}</span>
                            <span className="mt-1 block text-xs text-muted-foreground"><span className="sr-only">{t("redditOpinions.change")} </span>{changeLabel(row)}</span>
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                          <span className="sr-only">{t("redditOpinions.details")}</span>
                        </summary>
                        <div className="pb-4 pl-8 text-xs">
                          <p className="mb-3 break-words text-muted-foreground">{row.name}</p>
                          <dl className="flex flex-wrap gap-x-6 gap-y-2">
                            <div><dt className="text-muted-foreground">{t("redditOpinions.change")}</dt><dd className="mt-1 tabular-nums">{mentionChange(row) === null ? t("redditOpinions.noBaseline") : changeLabel(row)}</dd></div>
                            <div><dt className="text-muted-foreground">{t("redditOpinions.rankChange")}</dt><dd className="mt-1 tabular-nums">{rankLabel(row)}</dd></div>
                            <div><dt className="text-muted-foreground">{t("redditOpinions.upvotes")}</dt><dd className="mt-1 tabular-nums">{number.format(row.upvotes)}</dd></div>
                          </dl>
                          {watchButton(row)}
                        </div>
                      </details>
                    </li>)}
                  </ol>
                </div>
                <div role="region" aria-label={t("redditOpinions.title")} tabIndex={0} className="hidden overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:block">
                  <Table>
                    <caption className="sr-only">{t("redditOpinions.title")} · {t("redditOpinions.mobileMentions")}</caption>
                    <TableHeader><TableRow>
                      <TableHead scope="col" className="w-14">{t("redditOpinions.rank")}</TableHead>
                      <TableHead scope="col">{t("redditOpinions.stock")}</TableHead>
                      <TableHead scope="col" className="whitespace-nowrap text-right">{t("redditOpinions.mobileMentions")}</TableHead>
                      <TableHead scope="col" className="whitespace-nowrap text-right">{t("redditOpinions.change")}</TableHead>
                      <TableHead scope="col" className="whitespace-nowrap text-right">{t("redditOpinions.rankChange")}</TableHead>
                      <TableHead scope="col" className="text-right">{t("redditOpinions.upvotes")}</TableHead>
                      <TableHead scope="col" className="w-14"><span className="sr-only">{t("redditOpinions.followAction")}</span></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{rows.map((row) => <TableRow key={row.ticker}>
                      <TableCell className="text-muted-foreground">{row.rank}</TableCell>
                      <TableCell className="min-w-48 max-w-72">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true"><CompanyLogo symbol={row.ticker} name={row.name} size="sm" /></span>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold">{row.ticker}</span>
                            <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">{row.name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{number.format(row.mentions)}</TableCell>
                      <TableCell className="text-right" title={mentionChange(row) === null ? t("redditOpinions.noBaseline") : undefined}>{changeLabel(row)}</TableCell>
                      <TableCell className="text-right">{rankLabel(row)}</TableCell>
                      <TableCell className="text-right">{number.format(row.upvotes)}</TableCell>
                      <TableCell className="px-1">{watchButton(row, true)}</TableCell>
                    </TableRow>)}</TableBody>
                  </Table>
                </div>
              </> : data && <div role="status" className="py-12 text-center text-sm text-muted-foreground">
                <p>{t(data.results.length === 0 ? "redditOpinions.empty" : onlyWatchlist ? (watchlist.length === 0 ? "redditOpinions.watchlistEmpty" : "redditOpinions.watchlistNoResults") : "redditOpinions.noResults")}</p>
                {(query || onlyWatchlist) && <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQuery(""); setOnlyWatchlist(false); }}>{t("redditOpinions.clearFilters")}</Button>}
              </div>}
          </div>
          <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">
            <a href="https://apewisdom.io/methodology/" target="_blank" rel="noopener noreferrer" aria-label={t("redditOpinions.source")}
              className="inline-flex min-h-9 items-center gap-1 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              ApeWisdom <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            {data && <time dateTime={data.fetchedAt} title={`${t("redditOpinions.fetchedAt")} ${fullFetchTime}`} aria-label={`${t("redditOpinions.fetchedAt")} ${fullFetchTime}`}>
              {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(data.fetchedAt))}
            </time>}
          </footer>
          <details className="mt-2 text-xs leading-5 text-muted-foreground">
            <summary className="w-fit cursor-pointer rounded-sm py-1 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("redditOpinions.dataNotes")}</summary>
            <p className="mt-2 max-w-prose">{t("redditOpinions.note")}</p>
          </details>
        </div>
      </div>
    </DashboardLayout>
  );
}
