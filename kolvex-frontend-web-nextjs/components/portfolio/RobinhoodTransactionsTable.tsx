"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  CheckSquare,
  Download,
  FileText,
  Languages,
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
import { MarkdownBody } from "@/components/trading-analysis/markdown";
import {
  analyzeRobinhoodOrders,
  getRobinhoodOrders,
  type RobinhoodOrder,
  type RobinhoodWashSaleRiskSymbol,
} from "@/lib/robinhoodApi";
import { getAvailableProviders } from "@/lib/api/userApiKeysApi";
import { cn } from "@/lib/utils";
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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
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

/** Buttons stay fixed width; selects use min/max width so closed-state proportions stay natural */
const TRANSACTION_TOOLBAR_BTN =
  "h-9 w-48 shrink-0 gap-2 overflow-hidden px-3 text-xs disabled:opacity-50";
const TRANSACTION_TOOLBAR_SELECT = cn(
  "h-9 min-w-[11rem] max-w-[min(22rem,calc(100vw-3rem))] shrink px-3 py-0 text-xs disabled:opacity-50",
  "rounded-lg border border-border bg-background text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
);

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
  const [analysisLanguage, setAnalysisLanguage] = useState<"zh" | "en">("zh");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set()
  );
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
  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.has(order.order_id)),
    [orders, selectedOrderIds]
  );
  const selectedCount = selectedOrderIds.size;

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleCurrentPage = () => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      const allSelected = orders.every((order) => next.has(order.order_id));
      orders.forEach((order) => {
        if (allSelected) {
          next.delete(order.order_id);
        } else {
          next.add(order.order_id);
        }
      });
      return next;
    });
  };

  const buildCsv = (rows: RobinhoodOrder[]) => {
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
    return [
      headers.join(","),
      ...rows.map((order) =>
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
  };

  const downloadText = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

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
      const rows = selectedOrders.length > 0 ? selectedOrders : allOrders;
      downloadText(
        buildCsv(rows),
        `robinhood-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
        "text/csv;charset=utf-8"
      );
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
        order_ids: selectedOrders.map((order) => order.order_id),
        language: analysisLanguage,
      });
      setAnalysis(result.analysis);
      toast.success("AI trade analysis complete");
    } catch (error: any) {
      toast.error(error?.message || "Failed to analyze trades");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadAnalysis = () => {
    if (!analysis) return;
    downloadText(
      analysis,
      `robinhood-trade-analysis-${new Date().toISOString().slice(0, 10)}.md`,
      "text/markdown;charset=utf-8"
    );
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
          {selectedCount > 0 && (
            <span className="ml-2">
              · {selectedCount} {t("portfolio.transactions.selected")}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleCurrentPage}
            disabled={orders.length === 0}
            className={TRANSACTION_TOOLBAR_BTN}
          >
            <CheckSquare className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-center">
              {t("portfolio.transactions.selectPage")}
            </span>
          </Button>
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            disabled={syncing || loading}
            className={TRANSACTION_TOOLBAR_SELECT}
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
            className={TRANSACTION_TOOLBAR_SELECT}
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <select
            value={analysisLanguage}
            onChange={(event) =>
              setAnalysisLanguage(event.target.value as "zh" | "en")
            }
            className={TRANSACTION_TOOLBAR_SELECT}
          >
            <option value="zh">{t("portfolio.transactions.languageZh")}</option>
            <option value="en">{t("portfolio.transactions.languageEn")}</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className={TRANSACTION_TOOLBAR_BTN}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate text-center">
              {syncing
                ? t("portfolio.transactions.syncing")
                : t("portfolio.transactions.syncRobinhood")}
            </span>
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
            className={TRANSACTION_TOOLBAR_BTN}
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Brain className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate text-center">
              {t("portfolio.transactions.analyze")}
            </span>
          </Button>
          {analysis && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className={TRANSACTION_TOOLBAR_BTN}
            >
              <Languages className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-center">
                {t("portfolio.transactions.translate")}
              </span>
            </Button>
          )}
          {analysis && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAnalysis}
              className={TRANSACTION_TOOLBAR_BTN}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-center">
                {t("portfolio.transactions.downloadAnalysis")}
              </span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className={TRANSACTION_TOOLBAR_BTN}
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-center">
              {t("portfolio.transactions.exportCsv")}
            </span>
          </Button>
        </div>
      </div>

      {analysis && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-primary" />
            {t("portfolio.transactions.aiAnalysis")}
          </div>
          <MarkdownBody content={analysis} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 pl-4">
              <input
                type="checkbox"
                checked={
                  orders.length > 0 &&
                  orders.every((order) => selectedOrderIds.has(order.order_id))
                }
                onChange={toggleCurrentPage}
                aria-label={t("portfolio.transactions.selectPage")}
              />
            </TableHead>
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
                <TableCell className="pl-4">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.has(order.order_id)}
                    onChange={() => toggleOrder(order.order_id)}
                    aria-label={`${t("portfolio.transactions.select")} ${order.ticker}`}
                  />
                </TableCell>
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
