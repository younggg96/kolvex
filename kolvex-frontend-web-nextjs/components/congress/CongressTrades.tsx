"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { SecState, isMissing } from "@/components/decision/SecData";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useCopy } from "@/components/decision/shared";
import { ListCard, ListRows } from "@/components/ui/list-card";
import { Skeleton } from "@/components/ui/skeleton";
import CompanyLogo from "@/components/ui/company-logo";
import { Button } from "@/components/ui/button";
import { useCachedResource } from "@/hooks/useCachedResource";
import { validTicker } from "@/lib/decision";
import { marketStockHref } from "@/lib/stockLinks";
import { cn } from "@/lib/utils";

type Trade = {
  id: number;
  member_name: string;
  chamber: "house" | "senate" | null;
  ticker: string | null;
  asset_name: string | null;
  trade_date: string;
  filed_date: string;
  direction: "buy" | "sell" | "exchange" | "other";
  transaction_type: string;
  amount_range: string | null;
  source_url: string | null;
};

/**
 * House disclosures pack the whole filing line into the asset name
 * ("Coca-Cola Company (KO) [ST] P 10/01/2026 … $1,001 - $15,000").
 * Keep just the issuer so the row does not repeat the ticker, dates and range.
 */
export function cleanAssetName(name: string) {
  return (
    name
      .replace(/^\d{6,}\s+/, "")
      // Owner codes: spouse, joint, dependent child.
      .replace(/^(?:SP|JT|DC)\s+/, "")
      .replace(/\s+\([A-Z0-9.^=-]{1,10}\)[\s\S]*$/, "")
      .replace(/\s+\[[A-Z]{2}\][\s\S]*$/, "")
      .replace(/\s+(?:\(partial\)\s+)?[A-Z]{1,2}\s+\d{2}\/\d{2}\/\d{4}[\s\S]*$/, "")
      .trim()
  );
}

/** "$1,001 - $15,000" → "$1K–$15K" for the narrow phone row; the full range stays in the title. */
export function compactRange(range: string | null) {
  if (!range) return "—";
  const short = (value: string) => {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return value.trim();
    if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${n}`;
  };
  const parts = range.split(/\s*[-–]\s*/).filter(Boolean);
  if (parts.length === 2) return `${short(parts[0])}–${short(parts[1])}`;
  if (parts.length === 1) return /over/i.test(range) ? `${short(parts[0])}+` : short(parts[0]);
  return range;
}

type TradePage = { trades: Trade[]; has_more: boolean; synced: boolean };

export default function CongressTrades({
  filters = "",
  page = 1,
  onPageChange,
  toolbar,
}: {
  filters?: string;
  page?: number;
  onPageChange?: (page: number) => void;
  /** Desktop filters, shown inside the table card. */
  toolbar?: ReactNode;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const params = new URLSearchParams(filters);
  params.set("page", String(page));
  params.set("limit", onPageChange ? "25" : "5");
  const url = `/api/congress/trades?${params}`;
  const { data, loading, error, refresh } = useCachedResource(
    url,
    async (signal): Promise<TradePage> => {
      const response = await fetch(url, { signal, cache: "no-store" });
      if (!response.ok)
        throw Object.assign(new Error("Congress trades unavailable"), { status: response.status });
      return response.json();
    },
    { ttl: 60_000 },
  );
  const rows = data?.trades ?? [];
  const results = useRef<HTMLDivElement>(null);
  const date = (value: string) => <time dateTime={value}>{f.date(value)}</time>;
  const side = {
    buy: c("Buy", "买入"),
    sell: c("Sell", "卖出"),
    exchange: c("Exchange", "交换"),
    other: c("Other", "其他"),
  };
  const linkClass =
    "underline decoration-border underline-offset-4 hover:decoration-current focus-visible:outline-none focus-visible:decoration-current";

  const assetName = (row: Trade) => {
    if (!row.asset_name) return "";
    const name = cleanAssetName(row.asset_name);
    return name && name.toUpperCase() !== row.ticker?.toUpperCase() ? name : "";
  };
  const filed = c("Filed", "申报日");
  const traded = c("Traded", "交易日");
  const chamber = (value: Trade["chamber"]) =>
    value === "house" ? c("House", "众议院") : value === "senate" ? c("Senate", "参议院") : null;
  const tickerLink = (ticker: string | null) =>
    onPageChange && ticker && validTicker(ticker) ? (
      <Link className={linkClass} href={marketStockHref(ticker)}>
        {ticker}
      </Link>
    ) : (
      ticker
    );
  const direction = (row: Trade) => (
    <span
      className={
        row.direction === "buy"
          ? "text-positive"
          : row.direction === "sell"
            ? "text-negative"
            : undefined
      }
    >
      {side[row.direction]}
    </span>
  );
  const filingLink = (row: Trade, className = "") =>
    row.source_url ? (
      <a
        href={row.source_url}
        target="_blank"
        rel="noreferrer"
        className={`${linkClass} ${className}`}
        aria-label={c(`Original filing for ${row.member_name}`, `查看${row.member_name}的原始申报`)}
      >
        {c("Filing", "原文")}
      </a>
    ) : null;

  const emptyText = data?.synced
    ? c("No matching disclosures.", "没有符合条件的披露记录。")
    : c("Congress trade disclosures have yet to be imported.", "国会交易披露数据尚未导入。");
  const errorText = c(
    "Congress trades could not be loaded. Try again.",
    "暂时无法加载国会交易，请重试。",
  );
  // Same rule as SecState: a missing (404) source reads as empty, anything else as a failure.
  const failed = Boolean(error) && !isMissing(error);

  function changePage(nextPage: number) {
    onPageChange?.(nextPage);
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div ref={results} tabIndex={-1} className="min-w-0 scroll-mt-4 space-y-3 focus:outline-none">
      <div className="lg:hidden">
        <SecState
          loading={loading}
          error={error}
          empty={!rows.length}
          retry={refresh}
          skeleton={
            <ListCard className="space-y-3">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-28 rounded-xl" />
              ))}
            </ListCard>
          }
          emptyText={emptyText}
          errorText={errorText}
        />
      </div>
      {rows.length > 0 && (
        <ListCard className="px-4 py-0 lg:hidden">
          <ListRows
            role="list"
            aria-label={c("Congress trades", "国会议员交易")}
            className="divide-y divide-border"
          >
            {rows.map((row) => (
              <li key={row.id} className="py-3 text-sm">
                <div className="flex items-center gap-3">
                  {row.ticker && validTicker(row.ticker) ? (
                    <span aria-hidden>
                      <CompanyLogo symbol={row.ticker} customSize={36} />
                    </span>
                  ) : (
                    <span aria-hidden className="h-9 w-9 shrink-0 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {tickerLink(row.ticker) ?? (assetName(row) || c("Security", "证券"))}
                    </p>
                    {row.ticker && assetName(row) && (
                      <p className="truncate text-xs text-muted-foreground">{assetName(row)}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{direction(row)}</p>
                    <p
                      className="text-xs tabular-nums text-muted-foreground"
                      title={row.amount_range ?? undefined}
                    >
                      <span className="sr-only">
                        {c("Reported range in USD", "申报金额区间（美元）")}{" "}
                      </span>
                      {compactRange(row.amount_range)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 pl-12 text-xs text-muted-foreground">
                  <p className="min-w-0 truncate">
                    <span className="text-foreground">{row.member_name}</span>
                    {row.chamber && <> · {chamber(row.chamber)}</>}
                  </p>
                  <p className="shrink-0 tabular-nums">
                    <span className="sr-only">{traded} </span>
                    {date(row.trade_date)}
                    <span className="max-[360px]:hidden">
                      {" "}
                      · {filed} {date(row.filed_date)}
                    </span>
                  </p>
                </div>
                {row.source_url && (
                  <div className="pl-12">
                    {filingLink(
                      row,
                      "inline-flex min-h-9 items-center text-xs text-muted-foreground",
                    )}
                  </div>
                )}
              </li>
            ))}
          </ListRows>
        </ListCard>
      )}
      <ListCard className="hidden !p-0 lg:block">
        {toolbar && <div className="p-3 sm:p-4">{toolbar}</div>}
        <div
          role="region"
          tabIndex={0}
          aria-label={c(
            "Congress trades table, horizontally scrollable",
            "国会议员交易表，可横向滚动",
          )}
          className={cn(
            "overflow-x-auto focus-visible:outline-none",
            toolbar && "border-t border-border",
          )}
        >
          {loading ? (
            <div role="status" className="space-y-3 p-4">
              <span className="sr-only">{c("Loading…", "正在加载…")}</span>
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} aria-hidden className="h-10 rounded-xl" />
              ))}
            </div>
          ) : !rows.length ? (
            <div
              role={failed ? "alert" : "status"}
              className="px-6 py-10 text-center text-sm text-muted-foreground"
            >
              <p>{failed ? errorText : emptyText}</p>
              {failed && (
                <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
                  {c("Retry", "重试")}
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="text-xs text-muted-foreground shadow-[inset_0_-1px_0_rgb(var(--border))]">
                <tr>
                  <th scope="col" className="py-3 pl-4 pr-3 text-left font-normal">
                    {c("Security", "证券")}
                  </th>
                  <th scope="col" className="px-3 py-3 text-left font-normal">
                    {c("Member", "议员")}
                  </th>
                  <th scope="col" className="px-3 py-3 text-left font-normal">
                    {c("Transaction", "交易类型")}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">
                    {c("Reported range (USD)", "申报金额区间（美元）")}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">
                    {traded}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">
                    {filed}
                  </th>
                  <th scope="col" className="py-3 pl-3 pr-4 text-right font-normal">
                    {c("Source", "来源")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-foreground/[0.04] motion-reduce:transition-none"
                  >
                    <th scope="row" className="max-w-[18rem] py-3 pl-4 pr-3 text-left font-normal">
                      <div className="flex min-w-0 items-center gap-3">
                        {row.ticker && validTicker(row.ticker) ? (
                          <span aria-hidden className="shrink-0">
                            <CompanyLogo symbol={row.ticker} size="sm" />
                          </span>
                        ) : (
                          <span aria-hidden className="h-8 w-8 shrink-0 rounded-full bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {tickerLink(row.ticker) ?? (assetName(row) || c("Security", "证券"))}
                          </p>
                          {row.ticker && assetName(row) && (
                            <p
                              className="truncate text-xs text-muted-foreground"
                              title={row.asset_name ?? undefined}
                            >
                              {assetName(row)}
                            </p>
                          )}
                        </div>
                      </div>
                    </th>
                    <td className="max-w-[14rem] px-3 py-3">
                      <span className="block truncate">{row.member_name}</span>
                      {row.chamber && (
                        <span className="block text-xs text-muted-foreground">
                          {chamber(row.chamber)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium">{direction(row)}</td>
                    <td className="figure px-3 py-3 text-right">{row.amount_range ?? "—"}</td>
                    <td className="figure px-3 py-3 text-right">{date(row.trade_date)}</td>
                    <td className="figure px-3 py-3 text-right text-muted-foreground">
                      {date(row.filed_date)}
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      {row.source_url ? (
                        <a
                          href={row.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
                          aria-label={c(
                            `Original filing for ${row.member_name}`,
                            `查看${row.member_name}的原始申报`,
                          )}
                        >
                          {c("Filing", "原文")}
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ListCard>
      {onPageChange && (page > 1 || data?.has_more) && (
        <nav
          aria-label={c("Trade pages", "交易列表分页")}
          className="flex items-center justify-between gap-3 sm:justify-start"
        >
          <Button
            variant="outline"
            size="sm"
            className="max-md:min-h-11"
            disabled={page === 1 || loading}
            onClick={() => changePage(page - 1)}
          >
            {c("Previous", "上一页")}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
            {c(`Page ${page}`, `第 ${page} 页`)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="max-md:min-h-11"
            disabled={!data?.has_more || loading}
            onClick={() => changePage(page + 1)}
          >
            {c("Next", "下一页")}
          </Button>
        </nav>
      )}
    </div>
  );
}
