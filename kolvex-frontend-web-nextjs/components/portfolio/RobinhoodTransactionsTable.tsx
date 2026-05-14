"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/snaptradeApi";
import { useTranslation } from "@/lib/i18n";
import type { RobinhoodOrder } from "@/lib/robinhoodApi";

interface RobinhoodTransactionsTableProps {
  orders: RobinhoodOrder[];
}

function formatShares(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

function formatOrderDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeLabel(value?: string | null) {
  if (!value) return "-";
  return value.replace(/_/g, " ");
}

export function RobinhoodTransactionsTable({
  orders,
}: RobinhoodTransactionsTableProps) {
  const { t } = useTranslation();

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <ReceiptText className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold">
          {t("portfolio.transactions.emptyTitle")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("portfolio.transactions.emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">
              {t("portfolio.transactions.date")}
            </TableHead>
            <TableHead>{t("portfolio.transactions.side")}</TableHead>
            <TableHead>{t("portfolio.transactions.symbol")}</TableHead>
            <TableHead>{t("portfolio.transactions.type")}</TableHead>
            <TableHead className="text-right">
              {t("portfolio.transactions.quantity")}
            </TableHead>
            <TableHead className="text-right">
              {t("portfolio.transactions.averagePrice")}
            </TableHead>
            <TableHead className="text-right">
              {t("portfolio.transactions.amount")}
            </TableHead>
            <TableHead>{t("portfolio.transactions.status")}</TableHead>
            <TableHead className="pr-4 text-right">
              {t("portfolio.transactions.fees")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const isBuy = order.side?.toLowerCase() === "buy";
            return (
              <TableRow key={order.order_id}>
                <TableCell className="whitespace-nowrap pl-4 text-xs text-muted-foreground">
                  {formatOrderDate(order.executed_time || order.created_time)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      isBuy
                        ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                        : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                    }
                  >
                    {isBuy ? (
                      <ArrowDownRight className="mr-1 h-3 w-3" />
                    ) : (
                      <ArrowUpRight className="mr-1 h-3 w-3" />
                    )}
                    {normalizeLabel(order.side)}
                  </Badge>
                </TableCell>
                <TableCell className="font-semibold">{order.ticker}</TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {normalizeLabel(order.order_type)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatShares(order.quantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {order.average_price
                    ? formatCurrency(order.average_price)
                    : "-"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(order.total_amount || 0)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {normalizeLabel(order.state)}
                  </Badge>
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">
                  {formatCurrency(order.fees || 0)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

