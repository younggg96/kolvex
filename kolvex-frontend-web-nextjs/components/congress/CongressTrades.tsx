"use client";

import Link from "next/link";
import { useRef } from "react";
import { SecState, SourceNote } from "@/components/decision/SecData";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { DataTableSkeleton } from "@/components/decision/StockTabSkeletons";
import { useCopy } from "@/components/decision/shared";
import { ListCard, ListRows } from "@/components/ui/list-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCachedResource } from "@/hooks/useCachedResource";
import { validTicker } from "@/lib/decision";
import { marketStockHref } from "@/lib/stockLinks";

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

type TradePage = { trades: Trade[]; has_more: boolean; synced: boolean };

export default function CongressTrades({ filters = "", page = 1, onPageChange }: {
  filters?: string;
  page?: number;
  onPageChange?: (page: number) => void;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const params = new URLSearchParams(filters);
  params.set("page", String(page));
  params.set("limit", onPageChange ? "25" : "5");
  const url = `/api/congress/trades?${params}`;
  const { data, loading, error, refresh } = useCachedResource(url, async (signal): Promise<TradePage> => {
    const response = await fetch(url, { signal, cache: "no-store" });
    if (!response.ok) throw Object.assign(new Error("Congress trades unavailable"), { status: response.status });
    return response.json();
  }, { ttl: 60_000 });
  const rows = data?.trades ?? [];
  const results = useRef<HTMLDivElement>(null);
  const date = (value: string) => <time dateTime={value}>{f.date(value)}</time>;
  const side = { buy: c("Buy", "买入"), sell: c("Sell", "卖出"), exchange: c("Exchange", "交换"), other: c("Other", "其他") };
  const linkClass = "underline decoration-border underline-offset-4 hover:decoration-current focus-visible:outline-none focus-visible:decoration-current";

  const filed = c("Filed", "申报日");
  const traded = c("Traded", "交易日");
  const chamber = (value: Trade["chamber"]) =>
    value === "house" ? c("House", "众议院") : value === "senate" ? c("Senate", "参议院") : null;
  const tickerLink = (ticker: string | null) =>
    onPageChange && ticker && validTicker(ticker)
      ? <Link className={linkClass} href={marketStockHref(ticker)}>{ticker}</Link>
      : ticker;
  const direction = (row: Trade) => (
    <span className={row.direction === "buy" ? "text-positive" : row.direction === "sell" ? "text-negative" : undefined}>
      {side[row.direction]}
    </span>
  );
  const filingLink = (row: Trade, className = "") => row.source_url ? (
    <a href={row.source_url} target="_blank" rel="noreferrer" className={`${linkClass} ${className}`}
      aria-label={c(`Original filing for ${row.member_name}`, `查看${row.member_name}的原始申报`)}>
      {c("Filing", "原文")}
    </a>
  ) : null;

  function changePage(nextPage: number) {
    onPageChange?.(nextPage);
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div ref={results} tabIndex={-1} className="min-w-0 scroll-mt-4 space-y-3 focus:outline-none">
      <SecState loading={loading} error={error} empty={!rows.length} retry={refresh}
        skeleton={<>
          <ListCard className="space-y-3 lg:hidden">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
          </ListCard>
          <div className="hidden lg:block"><DataTableSkeleton columns={7} rows={5} /></div>
        </>}
        emptyText={data?.synced
          ? c("No matching disclosures.", "没有符合条件的披露记录。")
          : c("Congress trade disclosures have yet to be imported.", "国会交易披露数据尚未导入。")}
        errorText={c("Congress trades could not be loaded. Try again.", "暂时无法加载国会交易，请重试。")} />
      {rows.length > 0 && (
        <ListCard className="px-4 py-0 lg:hidden">
          <ListRows role="list" aria-label={c("Congress trades", "国会议员交易")} className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="space-y-2.5 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 break-words font-semibold">{tickerLink(row.ticker) ?? c("Security", "证券")}</p>
                  <p className="shrink-0 text-right font-medium">{direction(row)}</p>
                </div>
                {row.asset_name && <p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{row.asset_name}</p>}
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <p className="min-w-0 break-words">
                    {row.member_name}
                    {row.chamber && <span className="text-xs text-muted-foreground"> · {chamber(row.chamber)}</span>}
                  </p>
                  <p className="font-medium tabular-nums">
                    <span className="sr-only">{c("Reported range in USD", "申报金额区间（美元）")} </span>
                    {row.amount_range ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3">
                  <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                    <div className="flex gap-1"><dt>{filed}</dt><dd>{date(row.filed_date)}</dd></div>
                    <div className="flex gap-1"><dt>{traded}</dt><dd>{date(row.trade_date)}</dd></div>
                  </dl>
                  {filingLink(row, "inline-flex min-h-11 items-center text-xs")}
                </div>
              </li>
            ))}
          </ListRows>
        </ListCard>
      )}
      {rows.length > 0 && (
        <div className="glass-card hidden overflow-x-auto rounded-3xl border border-foreground/10 lg:block"
          role="region" aria-label={c("Congress trades table", "国会议员交易表")} tabIndex={0}>
          <Table>
            <TableHeader>
              <TableRow>
                {[filed, traded, c("Member", "议员"), c("Security", "证券"),
                  c("Transaction", "交易类型"), c("Reported range (USD)", "申报金额区间（美元）"), c("Source", "来源")].map((label) => (
                  <TableHead key={label} scope="col" className="whitespace-nowrap">{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap font-medium">{date(row.filed_date)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{date(row.trade_date)}</TableCell>
                  <TableCell className="min-w-32">
                    {row.member_name}
                    {row.chamber && <span className="block text-xs text-muted-foreground">
                      {chamber(row.chamber)}
                    </span>}
                  </TableCell>
                  <TableCell className="min-w-28">
                    {tickerLink(row.ticker)}
                    <span className="block max-w-52 text-xs text-muted-foreground">{row.asset_name ?? (row.ticker ? "" : "—")}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {direction(row)}
                    <span className="block text-xs text-muted-foreground">{row.transaction_type}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.amount_range ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {filingLink(row) ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {onPageChange && (page > 1 || data?.has_more) && (
        <nav aria-label={c("Trade pages", "交易列表分页")} className="flex items-center justify-between gap-3 sm:justify-start">
          <Button variant="outline" size="sm" className="max-md:min-h-11" disabled={page === 1 || loading} onClick={() => changePage(page - 1)}>
            {c("Previous", "上一页")}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">{c(`Page ${page}`, `第 ${page} 页`)}</span>
          <Button variant="outline" size="sm" className="max-md:min-h-11" disabled={!data?.has_more || loading} onClick={() => changePage(page + 1)}>
            {c("Next", "下一页")}
          </Button>
        </nav>
      )}
      <SourceNote>
        {c("Source: CongressInvests. Amounts show the reported range. Filings can appear after the trade date.", "数据来源为 CongressInvests。金额按申报区间显示，申报可能晚于交易日。")}{" "}
        <a className={linkClass} href="https://disclosures-clerk.house.gov/FinancialDisclosure" target="_blank" rel="noreferrer">{c("House filings", "众议院披露")}</a>
        {" · "}
        <a className={linkClass} href="https://efdsearch.senate.gov/search/" target="_blank" rel="noreferrer">{c("Senate filings", "参议院披露")}</a>
      </SourceNote>
    </div>
  );
}
