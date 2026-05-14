"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  Download,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  analyzeRobinhoodOrders,
  getRobinhoodOrders,
  type RobinhoodOrder,
  type RobinhoodWashSaleRiskSymbol,
} from "@/lib/robinhoodApi";
import { getAvailableProviders } from "@/lib/api/userApiKeysApi";
import {
  MODEL_CONFIGS,
  PROVIDER_NAME_TO_ID,
  getFirstAvailableModelId,
} from "@/components/chat/ChatInput";

interface RobinhoodTransactionsTableProps {
  orders: RobinhoodOrder[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  washSaleRisks: RobinhoodWashSaleRiskSymbol[];
  statusFilter: string;
  onStatusFilterChange: (statusFilter: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onSync: () => Promise<void>;
  syncing: boolean;
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
  total,
  hasMore,
  loading,
  washSaleRisks,
  statusFilter,
  onStatusFilterChange,
  onLoadMore,
  onSync,
  syncing,
}: RobinhoodTransactionsTableProps) {
  const { t } = useTranslation();
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const provider = useMemo(() => {
    const config = MODEL_CONFIGS.find((model) => model.id === selectedModel);
    return config ? PROVIDER_NAME_TO_ID[config.provider] : "openai";
  }, [selectedModel]);

  useEffect(() => {
    getAvailableProviders()
      .then((result) => {
        setAvailableProviders(result.available_providers);
        const firstModel = getFirstAvailableModelId(result.available_providers);
        if (firstModel) setSelectedModel(firstModel);
      })
      .catch(() => setAvailableProviders([]))
      .finally(() => setProvidersLoaded(true));
  }, []);

  const availableModels = useMemo(
    () =>
      MODEL_CONFIGS.filter((model) => {
        const providerId = PROVIDER_NAME_TO_ID[model.provider];
        return availableProviders.includes(providerId);
      }),
    [availableProviders]
  );

  const handleExportCsv = async () => {
    try {
      const allOrders: RobinhoodOrder[] = [];
      let offset = 0;
      const limit = 500;
      while (true) {
        const page = await getRobinhoodOrders(
          limit,
          offset,
          undefined,
          statusFilter
        );
        allOrders.push(...page.orders);
        if (!page.has_more) break;
        offset += limit;
      }
      const headers = [
        "date",
        "side",
        "ticker",
        "order_type",
        "quantity",
        "average_price",
        "total_amount",
        "realized_pnl",
        "realized_pnl_percent",
        "state",
        "fees",
        "order_id",
      ];
      const csv = [
        headers.join(","),
        ...allOrders.map((order) =>
          headers
            .map((key) => {
              const value =
                key === "date"
                  ? order.executed_time || order.created_time || ""
                  : (order as any)[key] ?? "";
              return `"${String(value).replace(/"/g, '""')}"`;
            })
            .join(",")
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `robinhood-transactions-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.message || "Failed to export Robinhood transactions");
    }
  };

  const handleAnalyze = async () => {
    if (providersLoaded && availableModels.length === 0) {
      toast.error("Add an AI API key in Settings before analyzing trades");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await analyzeRobinhoodOrders({
        provider,
        model: selectedModel,
        limit: 300,
      });
      setAnalysis(result.analysis);
      toast.success("AI trade analysis complete");
    } catch (error: any) {
      toast.error(error?.message || "Failed to analyze trades");
    } finally {
      setAnalyzing(false);
    }
  };

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
    <div className="space-y-3">
      {washSaleRisks.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4" />
            {t("portfolio.transactions.washRiskTitle")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {washSaleRisks.map((risk) => (
              <Badge key={risk.ticker} variant="outline">
                {risk.ticker} · {risk.days_remaining}d
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {orders.length} / {total} {t("portfolio.tabs.transactions")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            disabled={syncing || loading}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="filled">{t("portfolio.transactions.statusFilled")}</option>
            <option value="cancelled">
              {t("portfolio.transactions.statusCancelled")}
            </option>
            <option value="all">{t("portfolio.transactions.statusAll")}</option>
          </select>
          <select
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            disabled={!providersLoaded || availableModels.length === 0}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing
              ? t("portfolio.transactions.syncing")
              : t("portfolio.transactions.syncRobinhood")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyze}
            disabled={
              analyzing ||
              orders.length === 0 ||
              !providersLoaded ||
              availableModels.length === 0
            }
            className="gap-2"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            {t("portfolio.transactions.analyze")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {t("portfolio.transactions.exportCsv")}
          </Button>
        </div>
      </div>

      {analysis && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-primary" />
            {t("portfolio.transactions.aiAnalysis")}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {analysis}
          </div>
        </div>
      )}

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
                <TableHead className="text-right">
                  {t("portfolio.transactions.pnl")}
                </TableHead>
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
                <TableCell
                  className={
                    order.realized_pnl === null || order.realized_pnl === undefined
                      ? "text-right text-muted-foreground"
                      : order.realized_pnl >= 0
                        ? "text-right font-medium text-green-600 dark:text-green-400"
                        : "text-right font-medium text-red-600 dark:text-red-400"
                  }
                >
                  {order.realized_pnl === null || order.realized_pnl === undefined
                    ? "-"
                    : `${formatCurrency(order.realized_pnl)}${
                        order.realized_pnl_percent !== null &&
                        order.realized_pnl_percent !== undefined
                          ? ` (${order.realized_pnl_percent.toFixed(2)}%)`
                          : ""
                      }`}
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
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loading}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("portfolio.transactions.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
