"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CompanyLogo from "@/components/ui/company-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { mentionChange, type RedditRanking } from "@/lib/redditOpinions";

export default function RedditOpinionsPage() {
  const { t, locale } = useTranslation();
  const [data, setData] = useState<RedditRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/reddit-opinions", { signal: request.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Ranking unavailable");
      const ranking: RedditRanking = await response.json();
      if (!request.signal.aborted) setData(ranking);
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);

  const number = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US");
  const rows = data?.results.filter((row) => `${row.ticker} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase())) ?? [];

  return (
    <DashboardLayout title={t("redditOpinions.header")}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[28px] font-semibold tracking-tight md:text-[32px]">{t("redditOpinions.title")}</h2>
              <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{t("redditOpinions.description")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />}
              {t("redditOpinions.refresh")}
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3 text-xs leading-5 text-muted-foreground">
            <a href="https://apewisdom.io/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {t("redditOpinions.source")} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            {data && <span>{t("redditOpinions.fetchedAt")} <time dateTime={data.fetchedAt}>{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.fetchedAt))}</time></span>}
          </div>

          {error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm">
            <p>{t(data ? "redditOpinions.staleError" : "redditOpinions.error")}</p>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>{t("redditOpinions.retry")}</Button>
          </div>}

          <div className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("redditOpinions.coverage", { count: number.format(data?.results.length ?? 0) })}</p>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("redditOpinions.search")} aria-label={t("redditOpinions.search")} className="pl-9" />
            </div>
          </div>

          <div aria-busy={loading}>
            {loading && !data ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t("redditOpinions.loading")}</div>
              : data && rows.length > 0 ? <div role="region" aria-label={t("redditOpinions.title")} tabIndex={0} className="overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Table>
                  <caption className="sr-only">{t("redditOpinions.title")}</caption>
                  <TableHeader><TableRow>
                    <TableHead scope="col" className="w-14">{t("redditOpinions.rank")}</TableHead>
                    <TableHead scope="col">{t("redditOpinions.stock")}</TableHead>
                    <TableHead scope="col" className="text-right">{t("redditOpinions.mentions")}</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap text-right">{t("redditOpinions.change")}</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap text-right">{t("redditOpinions.rankChange")}</TableHead>
                    <TableHead scope="col" className="text-right">{t("redditOpinions.upvotes")}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{rows.map((row) => {
                    const change = mentionChange(row);
                    const rankChange = row.previousRank === null ? null : row.previousRank - row.rank;
                    return <TableRow key={row.ticker}>
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
                      <TableCell className="text-right">{change === null ? <span className="text-xs text-muted-foreground">{t("redditOpinions.noBaseline")}</span> : `${change > 0 ? "+" : ""}${number.format(Math.round(change))}%`}</TableCell>
                      <TableCell className="text-right">{rankChange === null ? <span className="text-xs text-muted-foreground">{t("redditOpinions.new")}</span> : rankChange > 0 ? t("redditOpinions.rankUp", { count: String(rankChange) }) : rankChange < 0 ? t("redditOpinions.rankDown", { count: String(-rankChange) }) : t("redditOpinions.unchanged")}</TableCell>
                      <TableCell className="text-right">{number.format(row.upvotes)}</TableCell>
                    </TableRow>;
                  })}</TableBody>
                </Table>
              </div> : data && <p role="status" className="py-12 text-center text-sm text-muted-foreground">{t(query.trim() ? "redditOpinions.noResults" : "redditOpinions.empty")}</p>}
          </div>
          <p className="mt-5 max-w-prose text-xs leading-6 text-muted-foreground">{t("redditOpinions.note")} <a href="https://apewisdom.io/methodology/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("redditOpinions.methodology")}</a></p>
        </div>
      </div>
    </DashboardLayout>
  );
}
