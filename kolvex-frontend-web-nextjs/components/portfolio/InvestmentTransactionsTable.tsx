"use client";

import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ListCard, ListLoadMore, ListToolbar } from "@/components/ui/list-card";
import { formatCurrency } from "@/lib/portfolioApi";
import type { PlaidInvestmentTransaction } from "@/lib/plaidApi";

interface InvestmentTransactionsTableProps {
  transactions: PlaidInvestmentTransaction[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  symbolFilter?: string;
  onSymbolFilterChange: (symbol?: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onSync: () => Promise<void>;
  syncing: boolean;
}

function formatQuantity(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString(locale, { maximumFractionDigits: 6 });
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const isCalendarDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(isCalendarDate ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(locale, {
    timeZone: isCalendarDate ? "UTC" : undefined,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function normalizeLabel(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return "-";
  const key = value.toLowerCase();
  if (key === "buy" || key === "sell") return t(`portfolio.transactions.${key}`);
  if (["cash", "dividend", "fee", "transfer"].includes(key)) {
    return t(`portfolio.transactions.${key}Type`);
  }
  return value.replace(/_/g, " ");
}

function exportTransactions(transactions: PlaidInvestmentTransaction[]) {
  const headers = [
    "date",
    "symbol",
    "name",
    "type",
    "subtype",
    "quantity",
    "price",
    "amount",
    "fees",
    "account",
  ];
  const rows = transactions.map((transaction) =>
    [
      transaction.date || "",
      transaction.symbol || "",
      transaction.name || "",
      transaction.type || "",
      transaction.subtype || "",
      transaction.quantity ?? "",
      transaction.price ?? "",
      transaction.amount ?? "",
      transaction.fees ?? "",
      transaction.account_name || transaction.account_id || "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plaid-investment-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function InvestmentTransactionsTable({
  transactions,
  total,
  hasMore,
  loading,
  symbolFilter,
  onSymbolFilterChange,
  onLoadMore,
  onSync,
  syncing,
}: InvestmentTransactionsTableProps) {
  const { t } = useTranslation();
  const dateLocale = t("common.intlLocale");
  const [symbolInput, setSymbolInput] = useState(symbolFilter || "");

  const visibleCount = transactions.length;
  const netAmount = useMemo(
    () => transactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0),
    [transactions],
  );

  const applySymbolFilter = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSymbolFilterChange(symbolInput);
  };

  return (
    <ListCard className="overflow-hidden !p-0 sm:!p-0 max-md:-mx-[16px]">
      <ListToolbar className="flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold">{t("portfolio.transactions.title")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("portfolio.transactions.loadedCount", {
              visible: visibleCount.toLocaleString(dateLocale),
              total: total.toLocaleString(dateLocale),
            })}
            {transactions.length > 0
              ? ` · ${t("portfolio.transactions.netAmount", { amount: formatCurrency(netAmount) })}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={applySymbolFilter} className="flex items-center gap-2">
            <SearchInput
              aria-label={t("portfolio.transactions.filterBySymbol")}
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value)}
              placeholder={t("portfolio.transactions.symbol")}
              size="sm"
              containerClassName="w-28"
            />
            <Button type="submit" variant="outline" size="sm" className="h-8 gap-1.5">
              {t("common.filter")}
            </Button>
          </form>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportTransactions(transactions)}
            disabled={transactions.length === 0}
            className="h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button size="sm" onClick={onSync} disabled={syncing} className="h-8 gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {t("portfolio.transactions.syncInvestments")}
          </Button>
        </div>
      </ListToolbar>

      <div className="overflow-x-auto">
        <Table className="min-w-[56.25rem]">
          <TableHeader>
            <TableRow>
              <TableHead>{t("portfolio.transactions.date")}</TableHead>
              <TableHead>{t("portfolio.transactions.security")}</TableHead>
              <TableHead>{t("portfolio.transactions.type")}</TableHead>
              <TableHead className="text-right">{t("portfolio.transactions.quantity")}</TableHead>
              <TableHead className="text-right">{t("portfolio.transactions.price")}</TableHead>
              <TableHead className="text-right">{t("portfolio.transactions.amount")}</TableHead>
              <TableHead className="text-right">{t("portfolio.transactions.fees")}</TableHead>
              <TableHead>{t("userMenu.account")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && transactions.length === 0 ? (
              <TransactionRowsSkeleton rows={6} />
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {t("portfolio.transactions.emptyTitle")}
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow
                  key={transaction.id || transaction.investment_transaction_id}
                  className="list-reveal"
                >
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDate(transaction.date, dateLocale)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{transaction.symbol || "-"}</div>
                    <div className="max-w-[13.75rem] truncate text-xs text-muted-foreground">
                      {transaction.name || transaction.security_id || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {normalizeLabel(transaction.type, t)}
                    </Badge>
                    {transaction.subtype && (
                      <div className="mt-1 text-xs capitalize text-muted-foreground">
                        {normalizeLabel(transaction.subtype, t)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(transaction.quantity, dateLocale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {transaction.price === null || transaction.price === undefined
                      ? "-"
                      : formatCurrency(transaction.price)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {transaction.amount === null || transaction.amount === undefined
                      ? "-"
                      : formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {transaction.fees === null || transaction.fees === undefined
                      ? "-"
                      : formatCurrency(transaction.fees)}
                  </TableCell>
                  <TableCell className="max-w-[11.25rem] truncate text-xs text-muted-foreground">
                    {transaction.account_name || transaction.account_id || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <ListLoadMore
          onClick={onLoadMore}
          loading={loading}
          skeleton={
            <div className="overflow-x-auto">
              <Table>
                <TableBody>
                  <TransactionRowsSkeleton rows={3} />
                </TableBody>
              </Table>
            </div>
          }
        >
          {t("common.loadMore")}
        </ListLoadMore>
      )}
    </ListCard>
  );
}

/** Table rows shaped like transactions: date, symbol/name, type badge, four figures, account. */
function TransactionRowsSkeleton({ rows }: { rows: number }) {
  const { t } = useTranslation();
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} aria-hidden="true" className="hover:bg-transparent">
          <TableCell>
            {i === 0 && (
              <span role="status" className="sr-only">
                {t("portfolio.transactions.loading")}
              </span>
            )}
            <Skeleton className="h-3 w-16 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-12 rounded-md" />
            <Skeleton
              className={i % 2 ? "mt-1.5 h-3 w-28 rounded-md" : "mt-1.5 h-3 w-40 rounded-md"}
            />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-14 rounded-full" />
          </TableCell>
          {[0, 1, 2, 3].map((j) => (
            <TableCell key={j}>
              <Skeleton className="ml-auto h-4 w-14 rounded-md" />
            </TableCell>
          ))}
          <TableCell>
            <Skeleton className="h-4 w-20 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
