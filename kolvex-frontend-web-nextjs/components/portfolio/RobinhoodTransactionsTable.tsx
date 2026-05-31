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
  SlidersHorizontal,
  X,
} from "lucide-react";
import { StatCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SwitchTab } from "@/components/ui/switch-tab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  getRobinhoodOptionOrders,
  getRobinhoodOrders,
  getRobinhoodSellPerformance,
  type RobinhoodOrder,
  type RobinhoodOptionOrder,
  type RobinhoodSellPerformanceResponse,
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
  optionOrders: RobinhoodOptionOrder[];
  total: number;
  optionTotal: number;
  hasMore: boolean;
  optionHasMore: boolean;
  loading: boolean;
  optionLoading: boolean;
  optionError?: string | null;
  washSaleRisks: RobinhoodWashSaleRiskSymbol[];
  statusFilter: string;
  symbolFilter?: string;
  onStatusFilterChange: (statusFilter: string) => Promise<void>;
  onSymbolFilterChange: (symbol?: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onLoadMoreOptions: () => Promise<void>;
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

function formatRiskDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const TRANSACTION_FILTER_SELECT = "h-8 w-[140px] shrink-0 text-xs bg-background";
const TRANSACTION_ACTION_BTN = "h-8 gap-1.5 px-2.5 text-xs";

export function RobinhoodTransactionsTable({
  orders,
  optionOrders,
  total,
  optionTotal,
  hasMore,
  optionHasMore,
  loading,
  optionLoading,
  optionError,
  washSaleRisks,
  statusFilter,
  symbolFilter,
  onStatusFilterChange,
  onSymbolFilterChange,
  onLoadMore,
  onLoadMoreOptions,
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
  const [washRiskModalOpen, setWashRiskModalOpen] = useState(false);
  const [assetType, setAssetType] = useState<"stocks" | "options">("stocks");
  const [optionTypeFilter, setOptionTypeFilter] = useState("all");
  const [optionSideFilter, setOptionSideFilter] = useState("all");
  const [optionStrategyFilter, setOptionStrategyFilter] = useState("all");
  const [optionSort, setOptionSort] = useState("newest");
  const [washRiskSort, setWashRiskSort] = useState<
    "expires_asc" | "expires_desc" | "loss_desc" | "loss_asc"
  >("expires_asc");
  const [sellPerformance, setSellPerformance] =
    useState<RobinhoodSellPerformanceResponse | null>(null);
  const [sellPerformanceLoading, setSellPerformanceLoading] = useState(false);
  const [sellPerformanceError, setSellPerformanceError] = useState<string | null>(null);
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

  useEffect(() => {
    setSelectedOrderIds(new Set());
  }, [statusFilter, symbolFilter]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `kolvex-robinhood-sell-performance:${symbolFilter || "all"}`;
    const cacheTtlMs = 5 * 60 * 1000;

    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          savedAt: number;
          data: RobinhoodSellPerformanceResponse;
        };
        if (Date.now() - parsed.savedAt < cacheTtlMs) {
          setSellPerformance(parsed.data);
        }
      }
    } catch {
      // Cache is an optimization only; ignore malformed entries.
    }

    setSellPerformanceError(null);
    setSellPerformanceLoading(true);
    getRobinhoodSellPerformance(100, 0, symbolFilter)
      .then((result) => {
        if (!cancelled) {
          setSellPerformance(result);
          try {
            window.sessionStorage.setItem(
              cacheKey,
              JSON.stringify({ savedAt: Date.now(), data: result })
            );
          } catch {
            // Session storage may be unavailable; the live response is still usable.
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to load Robinhood sell performance:", error);
          setSellPerformanceError(error?.message || "sell-performance-unavailable");
        }
      })
      .finally(() => {
        if (!cancelled) setSellPerformanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbolFilter]);

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
  const sortedWashSaleRisks = useMemo(() => {
    return [...washSaleRisks].sort((a, b) => {
      if (washRiskSort === "expires_asc") {
        return a.days_remaining - b.days_remaining || a.ticker.localeCompare(b.ticker);
      }
      if (washRiskSort === "expires_desc") {
        return b.days_remaining - a.days_remaining || a.ticker.localeCompare(b.ticker);
      }
      const aLoss = new Date(a.last_loss_sale_at).getTime() || 0;
      const bLoss = new Date(b.last_loss_sale_at).getTime() || 0;
      if (washRiskSort === "loss_desc") {
        return bLoss - aLoss || a.ticker.localeCompare(b.ticker);
      }
      return aLoss - bLoss || a.ticker.localeCompare(b.ticker);
    });
  }, [washSaleRisks, washRiskSort]);
  const selectedCount = selectedOrderIds.size;
  const sellPerformanceItems = useMemo(() => {
    return [...(sellPerformance?.items || [])].sort((a, b) => {
      const aPnl = a.opportunity_pnl ?? 0;
      const bPnl = b.opportunity_pnl ?? 0;
      return bPnl - aPnl;
    });
  }, [sellPerformance?.items]);
  const optionStrategyOptions = useMemo(() => {
    return Array.from(
      new Set(
        optionOrders
          .map((order) => order.opening_strategy || order.closing_strategy)
          .filter(Boolean)
      )
    ).sort() as string[];
  }, [optionOrders]);
  const filteredOptionOrders = useMemo(() => {
    const filtered = optionOrders.filter((order) => {
      const optionType = (order.option_type || "").toLowerCase();
      const side = (order.side || order.direction || "").toLowerCase();
      const strategy = order.opening_strategy || order.closing_strategy || "";
      if (optionTypeFilter !== "all" && optionType !== optionTypeFilter) return false;
      if (optionSideFilter !== "all" && !side.includes(optionSideFilter)) return false;
      if (optionStrategyFilter !== "all" && strategy !== optionStrategyFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (optionSort === "oldest") {
        return (
          new Date(a.executed_time || a.created_time || 0).getTime() -
          new Date(b.executed_time || b.created_time || 0).getTime()
        );
      }
      if (optionSort === "expiration_asc") {
        return (
          new Date(a.expiration_date || 0).getTime() -
          new Date(b.expiration_date || 0).getTime()
        );
      }
      if (optionSort === "premium_desc") {
        return (b.premium || 0) - (a.premium || 0);
      }
      return (
        new Date(b.executed_time || b.created_time || 0).getTime() -
        new Date(a.executed_time || a.created_time || 0).getTime()
      );
    });
  }, [
    optionOrders,
    optionSideFilter,
    optionSort,
    optionStrategyFilter,
    optionTypeFilter,
  ]);
  const optionSummary = useMemo(() => {
    const callCount = filteredOptionOrders.filter(
      (order) => order.option_type?.toLowerCase() === "call"
    ).length;
    const putCount = filteredOptionOrders.filter(
      (order) => order.option_type?.toLowerCase() === "put"
    ).length;
    const premium = filteredOptionOrders.reduce(
      (sum, order) => sum + Math.abs(order.premium || 0),
      0
    );
    return { callCount, putCount, premium };
  }, [filteredOptionOrders]);

  const headerSelectAllState = useMemo((): boolean | "indeterminate" => {
    if (orders.length === 0) return false;
    let onPage = 0;
    for (const order of orders) {
      if (selectedOrderIds.has(order.order_id)) onPage += 1;
    }
    if (onPage === 0) return false;
    if (onPage === orders.length) return true;
    return "indeterminate";
  }, [orders, selectedOrderIds]);

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

  const buildOptionCsv = (rows: RobinhoodOptionOrder[]) => {
    const headers = [
      "date",
      "underlying_symbol",
      "contract",
      "option_type",
      "expiration_date",
      "strike_price",
      "side",
      "direction",
      "opening_strategy",
      "closing_strategy",
      "quantity",
      "processed_quantity",
      "price",
      "premium",
      "state",
      "option_order_id",
      "leg_id",
    ];
    return [
      headers.join(","),
      ...rows.map((order) =>
        headers
          .map((key) => {
            const value =
              key === "date"
                ? order.executed_time || order.created_time || ""
                : key === "contract"
                  ? [
                      order.expiration_date,
                      order.strike_price
                        ? `$${Number(order.strike_price).toFixed(2)}`
                        : "",
                      order.option_type?.toUpperCase() || "",
                    ]
                      .filter(Boolean)
                      .join(" ")
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
      if (assetType === "options") {
        const allOptionOrders: RobinhoodOptionOrder[] = [];
        let offset = 0;
        const limit = 500;
        while (true) {
          const page = await getRobinhoodOptionOrders(
            limit,
            offset,
            symbolFilter,
            statusFilter
          );
          allOptionOrders.push(...page.orders);
          if (!page.has_more) break;
          offset += limit;
        }
        const exportedRows = allOptionOrders.filter((order) => {
          const optionType = (order.option_type || "").toLowerCase();
          const side = (order.side || order.direction || "").toLowerCase();
          const strategy = order.opening_strategy || order.closing_strategy || "";
          if (optionTypeFilter !== "all" && optionType !== optionTypeFilter) return false;
          if (optionSideFilter !== "all" && !side.includes(optionSideFilter)) return false;
          if (optionStrategyFilter !== "all" && strategy !== optionStrategyFilter) return false;
          return true;
        });
        downloadText(
          buildOptionCsv(exportedRows),
          `robinhood-option-transactions${symbolFilter ? `-${symbolFilter}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`,
          "text/csv;charset=utf-8"
        );
        return;
      }
      const allOrders: RobinhoodOrder[] = [];
      let offset = 0;
      const limit = 500;
      while (true) {
        const page = await getRobinhoodOrders(
          limit,
          offset,
          symbolFilter,
          statusFilter
        );
        allOrders.push(...page.orders);
        if (!page.has_more) break;
        offset += limit;
      }
      const rows = selectedOrders.length > 0 ? selectedOrders : allOrders;
      downloadText(
        buildCsv(rows),
        `robinhood-transactions${symbolFilter ? `-${symbolFilter}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`,
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

  return (
    <div className="space-y-3">
      {washSaleRisks.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4" />
              {t("portfolio.transactions.washRiskTitle")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWashRiskModalOpen(true)}
              className="h-8 gap-2 self-start border-amber-500/40 bg-background/60 text-xs sm:self-auto"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("portfolio.transactions.viewWashRiskDetails", {
                count: String(washSaleRisks.length),
              })}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {sortedWashSaleRisks.slice(0, 12).map((risk) => (
              <button
                key={risk.ticker}
                type="button"
                onClick={() => void onSymbolFilterChange(risk.ticker)}
              >
                <Badge variant="outline" className="cursor-pointer hover:bg-amber-500/15">
                {risk.ticker} · {risk.days_remaining}d
                </Badge>
              </button>
            ))}
            {washSaleRisks.length > 12 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setWashRiskModalOpen(true)}
                className="h-7 px-2 text-xs text-amber-700 dark:text-amber-300"
              >
                {t("portfolio.transactions.moreWashRiskSymbols", {
                  count: String(washSaleRisks.length - 12),
                })}
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={washRiskModalOpen} onOpenChange={setWashRiskModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("portfolio.transactions.washRiskTitle")}</DialogTitle>
            <DialogDescription>
              {t("portfolio.transactions.washRiskDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="text-sm text-muted-foreground">
              {washSaleRisks.length} {t("portfolio.transactions.symbols")}
            </div>
            <Select
              value={washRiskSort}
              onValueChange={(value) =>
                setWashRiskSort(value as typeof washRiskSort)
              }
            >
              <SelectTrigger className="h-9 w-[220px] bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expires_asc">
                  {t("portfolio.transactions.sortRiskExpiresAsc")}
                </SelectItem>
                <SelectItem value="expires_desc">
                  {t("portfolio.transactions.sortRiskExpiresDesc")}
                </SelectItem>
                <SelectItem value="loss_desc">
                  {t("portfolio.transactions.sortLossNewest")}
                </SelectItem>
                <SelectItem value="loss_asc">
                  {t("portfolio.transactions.sortLossOldest")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("portfolio.transactions.symbol")}</TableHead>
                  <TableHead>{t("portfolio.transactions.lastLossSale")}</TableHead>
                  <TableHead>{t("portfolio.transactions.riskExpires")}</TableHead>
                  <TableHead className="text-right">
                    {t("portfolio.transactions.daysRemaining")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("portfolio.transactions.lossAmount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedWashSaleRisks.map((risk) => (
                  <TableRow key={risk.ticker}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-semibold hover:text-primary hover:underline"
                        onClick={() => {
                          setWashRiskModalOpen(false);
                          void onSymbolFilterChange(risk.ticker);
                        }}
                      >
                        {risk.ticker}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRiskDate(risk.last_loss_sale_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRiskDate(risk.risk_expires_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {risk.days_remaining}d
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                      {formatCurrency(Math.abs(risk.loss_amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-border py-3 px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
              <SwitchTab
                options={[
                  {
                    value: "stocks",
                    label: t("portfolio.transactions.stocks"),
                  },
                  {
                    value: "options",
                    label: t("portfolio.transactions.options"),
                  },
                ]}
                value={assetType}
                onValueChange={(value) =>
                  setAssetType(value as "stocks" | "options")
                }
                variant="pills"
                size="sm"
                className="!w-fit shrink-0"
              />
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold">
                  {assetType === "options"
                    ? t("portfolio.transactions.optionRecordsTitle")
                    : t("portfolio.transactions.stockRecordsTitle")}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {assetType === "stocks"
                    ? `${orders.length} / ${total}`
                    : `${filteredOptionOrders.length} / ${optionTotal}`}{" "}
                  {t("portfolio.tabs.transactions")}
                  {symbolFilter && (
                    <span className="ml-1">
                      · {symbolFilter}
                    </span>
                  )}
                  {assetType === "stocks" && selectedCount > 0 && (
                    <span className="ml-1">
                      · {selectedCount} {t("portfolio.transactions.selected")}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  void onStatusFilterChange(value);
                }}
                disabled={syncing || loading || optionLoading}
              >
                <SelectTrigger className={TRANSACTION_FILTER_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filled">
                    {t("portfolio.transactions.statusFilled")}
                  </SelectItem>
                  <SelectItem value="cancelled">
                    {t("portfolio.transactions.statusCancelled")}
                  </SelectItem>
                  <SelectItem value="all">
                    {t("portfolio.transactions.statusAll")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSync}
                disabled={syncing}
                className={TRANSACTION_ACTION_BTN}
              >
                {syncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {syncing
                  ? t("portfolio.transactions.syncing")
                  : t("portfolio.transactions.syncRobinhood")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportCsv}
                className={TRANSACTION_ACTION_BTN}
              >
                <Download className="h-3.5 w-3.5" />
                {t("portfolio.transactions.exportCsv")}
              </Button>
              {assetType === "stocks" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleCurrentPage}
                    disabled={orders.length === 0}
                    className={TRANSACTION_ACTION_BTN}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    {t("portfolio.transactions.selectPage")}
                  </Button>
                  {availableModels.length > 0 ? (
                    <Select
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                      disabled={!providersLoaded}
                    >
                      <SelectTrigger className={cn(TRANSACTION_FILTER_SELECT, "w-[120px]")}>
                        <SelectValue placeholder="Model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Select
                    value={analysisLanguage}
                    onValueChange={(v) =>
                      setAnalysisLanguage(v as "zh" | "en")
                    }
                  >
                    <SelectTrigger className="h-8 w-[88px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">
                        {t("portfolio.transactions.languageZh")}
                      </SelectItem>
                      <SelectItem value="en">
                        {t("portfolio.transactions.languageEn")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={
                      analyzing ||
                      orders.length === 0 ||
                      !providersLoaded ||
                      availableModels.length === 0
                    }
                    className={TRANSACTION_ACTION_BTN}
                  >
                    {analyzing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Brain className="h-3.5 w-3.5" />
                    )}
                    {t("portfolio.transactions.analyze")}
                  </Button>
                </>
              )}
            </div>
          </div>

          {assetType === "options" && (
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
              <StatCard
                label={t("portfolio.transactions.optionCalls")}
                value={optionSummary.callCount}
                variant="positive"
              />
              <StatCard
                label={t("portfolio.transactions.optionPuts")}
                value={optionSummary.putCount}
                variant="negative"
              />
              <StatCard
                label={t("portfolio.transactions.optionPremium")}
                value={formatCurrency(optionSummary.premium)}
                className="col-span-2 sm:col-span-1"
              />
            </div>
          )}

          {assetType === "options" && (
            <div className="flex flex-wrap gap-2">
              <Select value={optionTypeFilter} onValueChange={setOptionTypeFilter}>
                <SelectTrigger className={TRANSACTION_FILTER_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("portfolio.transactions.optionTypeAll")}</SelectItem>
                  <SelectItem value="call">CALL</SelectItem>
                  <SelectItem value="put">PUT</SelectItem>
                </SelectContent>
              </Select>
              <Select value={optionSideFilter} onValueChange={setOptionSideFilter}>
                <SelectTrigger className={TRANSACTION_FILTER_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("portfolio.transactions.sideAll")}</SelectItem>
                  <SelectItem value="buy">{t("portfolio.transactions.buy")}</SelectItem>
                  <SelectItem value="sell">{t("portfolio.transactions.sell")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={optionStrategyFilter} onValueChange={setOptionStrategyFilter}>
                <SelectTrigger className={cn(TRANSACTION_FILTER_SELECT, "w-[160px]")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("portfolio.transactions.strategyAll")}</SelectItem>
                  {optionStrategyOptions.map((strategy) => (
                    <SelectItem key={strategy} value={strategy}>
                      {normalizeLabel(strategy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={optionSort} onValueChange={setOptionSort}>
                <SelectTrigger className={TRANSACTION_FILTER_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("portfolio.transactions.sortNewest")}</SelectItem>
                  <SelectItem value="oldest">{t("portfolio.transactions.sortOldest")}</SelectItem>
                  <SelectItem value="expiration_asc">{t("portfolio.transactions.sortExpiration")}</SelectItem>
                  <SelectItem value="premium_desc">{t("portfolio.transactions.sortPremium")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>

        <CardContent className="!p-0">
          {symbolFilter && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-muted/30">
              <Badge variant="outline" className="gap-1.5 py-1 border-primary/30 text-primary">
                {symbolFilter}
                <button
                  type="button"
                  onClick={() => void onSymbolFilterChange(undefined)}
                  aria-label={t("portfolio.transactions.clearSymbolFilter")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("portfolio.transactions.viewingSymbolHistory", {
                  symbol: symbolFilter,
                })}
              </span>
            </div>
          )}

          {assetType === "stocks" && analysis && (
            <div className="border-b border-border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Brain className="h-4 w-4 text-primary" />
                  {t("portfolio.transactions.aiAnalysis")}
                </div>
                <div className="flex items-center gap-1">
                  <Select
                    value={analysisLanguage}
                    onValueChange={(v) =>
                      setAnalysisLanguage(v as "zh" | "en")
                    }
                  >
                    <SelectTrigger className="h-8 w-[100px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">
                        {t("portfolio.transactions.languageZh")}
                      </SelectItem>
                      <SelectItem value="en">
                        {t("portfolio.transactions.languageEn")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="h-8 px-2 text-xs"
                  >
                    <Languages className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadAnalysis}
                    className="h-8 px-2 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <MarkdownBody content={analysis} />
            </div>
          )}

          {assetType === "stocks" && (
      <div className="border-b border-border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold">
              {t("portfolio.transactions.sellReviewTitle")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("portfolio.transactions.sellReviewDescription")}
            </div>
          </div>
          {sellPerformanceLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {sellPerformance && sellPerformance.summary.total_sells > 0 ? (
          <>
            <div className="mt-4 grid gap-2 grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t("portfolio.transactions.soldTooEarly")}
                value={sellPerformance.summary.sold_too_early_count}
                variant="negative"
              />
              <StatCard
                label={t("portfolio.transactions.goodSale")}
                value={sellPerformance.summary.good_sale_count}
                variant="positive"
              />
              <StatCard
                label={t("portfolio.transactions.missedUpside")}
                value={formatCurrency(sellPerformance.summary.missed_upside_amount)}
                variant="negative"
              />
              <StatCard
                label={t("portfolio.transactions.avoidedDownside")}
                value={formatCurrency(sellPerformance.summary.avoided_downside_amount)}
                variant="positive"
              />
            </div>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("portfolio.transactions.symbol")}</TableHead>
                    <TableHead>{t("portfolio.transactions.date")}</TableHead>
                    <TableHead className="text-right">
                      {t("portfolio.transactions.sellPrice")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("portfolio.transactions.currentPrice")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("portfolio.transactions.afterSellMove")}
                    </TableHead>
                    <TableHead>{t("portfolio.transactions.verdict")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellPerformanceItems.slice(0, 8).map((item) => {
                    const isMissed = item.verdict === "sold_too_early";
                    const isGood = item.verdict === "good_sale";
                    return (
                      <TableRow key={item.order_id}>
                        <TableCell>
                          <button
                            type="button"
                            className="font-semibold hover:text-primary hover:underline"
                            onClick={() => void onSymbolFilterChange(item.ticker)}
                          >
                            {item.ticker}
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatOrderDate(item.sell_time)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(item.sell_price)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.current_price ? formatCurrency(item.current_price) : "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium tabular-nums",
                            isMissed && "text-red-600 dark:text-red-400",
                            isGood && "text-green-600 dark:text-green-400"
                          )}
                        >
                          {item.opportunity_pnl === null ||
                          item.opportunity_pnl === undefined
                            ? "-"
                            : `${formatCurrency(item.opportunity_pnl)}${
                                item.price_change_percent !== null &&
                                item.price_change_percent !== undefined
                                  ? ` (${item.price_change_percent.toFixed(2)}%)`
                                  : ""
                              }`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              isMissed &&
                                "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
                              isGood &&
                                "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                            )}
                          >
                            {isMissed
                              ? t("portfolio.transactions.soldTooEarly")
                              : isGood
                                ? t("portfolio.transactions.goodSale")
                                : t("portfolio.transactions.flatOrUnknown")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">
            {sellPerformanceLoading
              ? t("common.loading")
              : sellPerformanceError
                ? t("portfolio.transactions.sellReviewUnavailable")
                : t("portfolio.transactions.noSellReview")}
          </div>
        )}
        {sellPerformanceError && sellPerformance && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            {t("portfolio.transactions.sellReviewStaleData")}
          </div>
        )}
      </div>
          )}

          {assetType === "options" ? (
        optionError ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
              <div>
                <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {t("portfolio.transactions.optionOrdersSetupRequired")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("portfolio.transactions.optionOrdersSetupDescription")}
                </p>
              </div>
            </div>
          </div>
        ) : filteredOptionOrders.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <ReceiptText className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold">
              {t("portfolio.transactions.noOptionOrders")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("portfolio.transactions.noOptionOrdersDescription")}
            </p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 bg-primary/5 text-xs font-medium text-primary dark:text-primary-dark flex items-center border-y border-primary/30 dark:border-border-dark">
              {t("portfolio.table.optionsContracts")}
            </div>
            <div className="overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("portfolio.transactions.date")}</TableHead>
                  <TableHead>{t("portfolio.transactions.symbol")}</TableHead>
                  <TableHead>{t("portfolio.transactions.contract")}</TableHead>
                  <TableHead>{t("portfolio.transactions.side")}</TableHead>
                  <TableHead>{t("portfolio.transactions.strategy")}</TableHead>
                  <TableHead className="text-right">{t("portfolio.transactions.quantity")}</TableHead>
                  <TableHead className="text-right">{t("portfolio.transactions.price")}</TableHead>
                  <TableHead className="text-right">{t("portfolio.transactions.premium")}</TableHead>
                  <TableHead className="pr-4">{t("portfolio.transactions.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOptionOrders.map((order) => {
                  const isCall = order.option_type?.toLowerCase() === "call";
                  const isBuy = (order.side || order.direction || "")
                    .toLowerCase()
                    .includes("buy");
                  return (
                  <TableRow
                    key={`${order.option_order_id}:${order.leg_id}`}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="whitespace-nowrap pl-4 text-xs text-muted-foreground">
                      {formatOrderDate(order.executed_time || order.created_time)}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-semibold hover:text-primary hover:underline"
                        onClick={() =>
                          void onSymbolFilterChange(order.underlying_symbol || order.chain_symbol || undefined)
                        }
                      >
                        {order.underlying_symbol || order.chain_symbol || "-"}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isCall
                              ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                          }
                        >
                          {order.option_type?.toUpperCase() || "-"}
                        </Badge>
                        <span>
                          {[
                            order.expiration_date,
                            order.strike_price
                              ? `$${Number(order.strike_price).toFixed(2)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                      </div>
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
                        {normalizeLabel(order.side || order.direction)}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {normalizeLabel(order.opening_strategy || order.closing_strategy)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatShares(order.processed_quantity || order.quantity)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {order.price ? formatCurrency(order.price) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(order.premium || 0)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <Badge variant="secondary" className="capitalize">
                        {normalizeLabel(order.state)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </>
        )
      ) : orders.length === 0 ? (
        <div className="p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <ReceiptText className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">
            {t("portfolio.transactions.emptySymbolTitle", {
              symbol: symbolFilter || "",
            })}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("portfolio.transactions.emptySymbolDescription")}
          </p>
        </div>
      ) : (
      <>
        <div className="px-4 py-3 bg-primary/5 text-xs font-medium text-primary dark:text-primary-dark flex items-center border-y border-primary/30 dark:border-border-dark">
          {t("portfolio.transactions.stockRecordsTitle")}
        </div>
        <div className="overflow-x-auto">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={headerSelectAllState}
                onCheckedChange={() => toggleCurrentPage()}
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
                  <Checkbox
                    checked={selectedOrderIds.has(order.order_id)}
                    onCheckedChange={() => toggleOrder(order.order_id)}
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
                <TableCell className="font-semibold">
                  <button
                    type="button"
                    className="hover:text-primary hover:underline"
                    onClick={() => void onSymbolFilterChange(order.ticker)}
                    title={t("portfolio.transactions.viewSymbolHistory", {
                      symbol: order.ticker,
                    })}
                  >
                    {order.ticker}
                  </button>
                </TableCell>
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
      </>
      )}

          {assetType === "stocks" && hasMore && (
            <div className="flex justify-center border-t border-border py-4">
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
          {assetType === "options" && optionHasMore && (
            <div className="flex justify-center border-t border-border py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMoreOptions}
                disabled={optionLoading}
                className="gap-2"
              >
                {optionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("portfolio.transactions.loadMore")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
