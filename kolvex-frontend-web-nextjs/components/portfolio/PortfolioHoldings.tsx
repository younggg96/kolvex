"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AlertCircle, RefreshCw, Clock } from "lucide-react";
import { SwitchTab } from "@/components/ui/switch-tab";
import { EmptyState } from "@/components/common/EmptyState";
import { calculateTotalValue, calculateTotalPnL } from "@/lib/snaptradeApi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

// Local components
import { PortfolioSkeleton } from "./PortfolioSkeleton";
import { PortfolioStatsGrid } from "./PortfolioStatsGrid";
import { PortfolioAllocation } from "./PortfolioAllocation";
import { PortfolioHeaderActions } from "./PortfolioHeaderActions";
import { PortfolioPerformanceChart } from "./PortfolioPerformanceChart";
import { NotConnectedState, InitialSyncState } from "./ConnectionStates";
import { AccountCard } from "./AccountCard";
import { DisconnectDialog } from "./DisconnectDialog";
import { PortfolioAIAnalysis } from "./PortfolioAIAnalysis";

// Hooks
import { usePortfolioData } from "./hooks/usePortfolioData";
import { useEquitySort, useOptionSort } from "./hooks/usePortfolioSort";
import {
  useStockDataCache,
  usePortfolioSymbols,
} from "./hooks/useStockDataCache";

// Utils
import { downloadHoldings } from "./utils/downloadHoldings";

// Types
import type { PortfolioHoldingsProps } from "./types";
export type { PortfolioHeaderActionsProps } from "./PortfolioHeaderActions";

export default function PortfolioHoldings({
  userId,
  isOwner = false,
  onHeaderActionsReady,
}: PortfolioHoldingsProps) {
  const { t, locale } = useTranslation();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    new Set()
  );
  const [activeTab, setActiveTab] = useState<"holdings" | "analytics" | "ai-insights">(
    "holdings"
  );
  const [sparklineDataMap, setSparklineDataMap] = useState<
    Map<string, number[]>
  >(new Map());
  const [sectorDataMap, setSectorDataMap] = useState<Map<string, string>>(
    new Map()
  );

  // Custom hooks
  const {
    status,
    holdings,
    loading,
    syncing,
    connecting,
    disconnecting,
    copied,
    handleConnect,
    handleConnectRobinhood,
    handleSync,
    handleTogglePublic,
    handleDisconnect,
    handleCopyShareLink,
    handleTogglePositionVisibility,
  } = usePortfolioData({ userId, isOwner });

  const equitySort = useEquitySort();
  const optionSort = useOptionSort();

  // Stock data cache
  const {
    fetchSparklines,
    fetchSectors,
    isLoading: stockDataLoading,
    lastRefreshTime,
  } = useStockDataCache();

  // Get all unique symbols from holdings
  const portfolioSymbols = usePortfolioSymbols(holdings?.accounts);

  // Handle download
  const handleDownload = useCallback(
    (format: "csv" | "json") => {
      if (holdings) {
        downloadHoldings(holdings, format);
      }
    },
    [holdings]
  );

  // Handle disconnect with dialog close
  const handleDisconnectAndClose = useCallback(async () => {
    const success = await handleDisconnect();
    if (success) {
      setDisconnectDialogOpen(false);
    }
  }, [handleDisconnect]);

  // Expand accounts with positions by default, collapse empty accounts
  useEffect(() => {
    if (holdings?.accounts) {
      const accountsWithPositions = holdings.accounts
        .filter((a) => (a.snaptrade_positions?.length || 0) > 0)
        .map((a) => a.id);
      setExpandedAccounts(new Set(accountsWithPositions));
    }
  }, [holdings?.accounts]);

  // Create a stable key for the symbols to detect actual changes
  const symbolsKey = useMemo(
    () => portfolioSymbols.sort().join(","),
    [portfolioSymbols]
  );

  // Fetch stock data when symbols change (uses cache)
  useEffect(() => {
    if (portfolioSymbols.length === 0) return;

    let cancelled = false;

    const fetchData = async () => {
      // Fetch sparklines and sectors in parallel using cache
      const [sparklines, sectors] = await Promise.all([
        fetchSparklines(portfolioSymbols, false),
        fetchSectors(portfolioSymbols, false),
      ]);

      if (!cancelled) {
        setSparklineDataMap(sparklines);
        setSectorDataMap(sectors);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
    // Use symbolsKey instead of portfolioSymbols to prevent re-runs when array reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, fetchSparklines, fetchSectors]);

  // Handle manual refresh
  const handleRefreshStockData = useCallback(async () => {
    if (portfolioSymbols.length === 0) return;

    const [sparklines, sectors] = await Promise.all([
      fetchSparklines(portfolioSymbols, true),
      fetchSectors(portfolioSymbols, true),
    ]);

    setSparklineDataMap(sparklines);
    setSectorDataMap(sectors);
  }, [portfolioSymbols, fetchSparklines, fetchSectors]);

  // Format last refresh time
  const formatLastRefresh = useMemo(() => {
    if (!lastRefreshTime) return null;
    const now = Date.now();
    const diffMs = now - lastRefreshTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return locale === "zh" ? "刚刚" : "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    return `${diffHours}h`;
  }, [lastRefreshTime, locale]);

  // Notify parent component of header actions state
  useEffect(() => {
    if (onHeaderActionsReady) {
      if (isOwner && status?.is_connected) {
        onHeaderActionsReady({
          syncing,
          onSync: handleSync,
          holdings,
          onTogglePublic: handleTogglePublic,
          onCopyShareLink: handleCopyShareLink,
          copied,
          onConnect: handleConnect,
          onDisconnect: () => setDisconnectDialogOpen(true),
          onDownload: handleDownload,
        });
      } else {
        onHeaderActionsReady(null);
      }
    }
  }, [
    onHeaderActionsReady,
    isOwner,
    status?.is_connected,
    syncing,
    holdings,
    copied,
    handleSync,
    handleTogglePublic,
    handleCopyShareLink,
    handleConnect,
    handleDownload,
  ]);

  const toggleAccount = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // Calculate summary data
  // For owner: calculate locally; For public view: use backend values (which may be "***")
  const publicHoldings = holdings as any;
  const totalValue = isOwner
    ? holdings
      ? calculateTotalValue(holdings)
      : 0
    : publicHoldings?.total_value ?? 0;
  const totalPnL = isOwner
    ? holdings
      ? calculateTotalPnL(holdings)
      : 0
    : publicHoldings?.total_pnl ?? 0;
  const pnlPercent = isOwner
    ? typeof totalValue === "number" && totalValue > 0
      ? ((totalPnL as number) /
        ((totalValue as number) - (totalPnL as number))) *
      100
      : 0
    : publicHoldings?.pnl_percent ?? 0;
  const totalPositions = isOwner
    ? holdings?.accounts?.reduce(
      (acc, curr) => acc + (curr.snaptrade_positions?.length || 0),
      0
    ) || 0
    : publicHoldings?.positions_count ?? 0;

  if (loading) {
    return <PortfolioSkeleton />;
  }

  // State 1: Not registered
  if (!status?.is_registered) {
    return (
      <NotConnectedState
        onConnect={handleConnect}
        onConnectRobinhood={handleConnectRobinhood}
        connecting={connecting}
      />
    );
  }

  // State 2: Registered but not synced
  if (!status?.is_connected) {
    return <InitialSyncState onSync={handleSync} syncing={syncing} />;
  }

  return (
    <div className="space-y-3">
      {/* Inline Header Actions (when onHeaderActionsReady is not provided) */}
      {isOwner && !onHeaderActionsReady && status?.is_connected && (
        <PortfolioHeaderActions
          syncing={syncing}
          onSync={handleSync}
          holdings={holdings}
          onTogglePublic={handleTogglePublic}
          onCopyShareLink={handleCopyShareLink}
          copied={copied}
          onConnect={handleConnect}
          onDisconnect={() => setDisconnectDialogOpen(true)}
          onDownload={handleDownload}
        />
      )}

      {/* Stats Grid */}
      <PortfolioStatsGrid
        totalValue={totalValue}
        totalPnL={
          isOwner || holdings?.privacy_settings?.show_total_pnl
            ? totalPnL
            : "***"
        }
        pnlPercent={
          isOwner || holdings?.privacy_settings?.show_pnl_percent
            ? pnlPercent
            : "***"
        }
        totalPositions={
          isOwner || holdings?.privacy_settings?.show_positions_count
            ? totalPositions
            : "***"
        }
        accountsCount={
          isOwner || holdings?.privacy_settings?.show_positions_count
            ? holdings?.accounts?.length || 0
            : "***"
        }
        hiddenPositionsCount={
          !isOwner ? publicHoldings?.hidden_positions_count : undefined
        }
        hiddenAccountsCount={
          !isOwner ? publicHoldings?.hidden_accounts_count : undefined
        }
      />

      {/* Performance Chart */}
      {holdings?.accounts && holdings.accounts.length > 0 && userId && (
        <PortfolioPerformanceChart userId={userId} isOwner={isOwner} />
      )}

      {/* Tab Navigation with Refresh Button */}
      {holdings?.accounts && holdings.accounts.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-4">
            <SwitchTab
              options={[
                { value: "holdings", label: t("portfolio.tabs.holdings") },
                { value: "analytics", label: t("portfolio.tabs.analytics") },
                { value: "ai-insights", label: t("portfolio.tabs.aiInsights") },
              ]}
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "holdings" | "analytics" | "ai-insights")}
              variant="underline"
              size="md"
              className="!w-fit"
            />

            {/* Stock Data Refresh Button */}
            <div className="flex items-center gap-2">
              {formatLastRefresh && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatLastRefresh}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshStockData}
                disabled={stockDataLoading}
                className="gap-1.5 text-xs h-7 px-2"
              >
                <RefreshCw
                  className={cn(
                    "w-3.5 h-3.5",
                    stockDataLoading && "animate-spin"
                  )}
                />
                {stockDataLoading ? t("portfolio.holdings.refreshing") : t("portfolio.holdings.refreshPrices")}
              </Button>
            </div>
          </div>

          {/* Holdings Tab Content */}
          {activeTab === "holdings" && (
            <div className="space-y-2">
              {holdings?.accounts?.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  isExpanded={expandedAccounts.has(account.id)}
                  onToggle={() => toggleAccount(account.id)}
                  isOwner={isOwner}
                  isPublic={holdings?.is_public || false}
                  privacySettings={holdings?.privacy_settings}
                  equitySortKey={equitySort.sortKey}
                  equitySortDir={equitySort.sortDir}
                  onEquitySort={equitySort.handleSort}
                  sortEquityPositions={equitySort.sortPositions}
                  optionSortKey={optionSort.sortKey}
                  optionSortDir={optionSort.sortDir}
                  onOptionSort={optionSort.handleSort}
                  sortOptionPositions={optionSort.sortPositions}
                  sparklineDataMap={sparklineDataMap}
                  onToggleVisibility={handleTogglePositionVisibility}
                />
              ))}
            </div>
          )}

          {/* Analytics Tab Content */}
          {activeTab === "analytics" && (
            <PortfolioAllocation
              holdings={holdings.accounts.flatMap(
                (account) => account.snaptrade_positions || []
              )}
              isOwner={isOwner}
              cachedSectorMap={sectorDataMap}
            />
          )}

          {/* AI Insights Tab Content */}
          {activeTab === "ai-insights" && isOwner && (
            <PortfolioAIAnalysis />
          )}

          {/* AI Insights - Non-owner message */}
          {activeTab === "ai-insights" && !isOwner && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t("portfolio.holdings.aiOnlyOwner")}</p>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {(!holdings?.accounts || holdings.accounts.length === 0) && (
        <EmptyState
          icon={AlertCircle}
          title={t("portfolio.holdings.noAccountData")}
          description={t("portfolio.holdings.noAccountDataDesc")}
          action={{
            label: syncing ? t("portfolio.connect.syncing") : t("portfolio.holdings.syncNow"),
            onClick: handleSync,
          }}
        />
      )}

      {/* Disconnect Dialog */}
      <DisconnectDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
        onDisconnect={handleDisconnectAndClose}
        disconnecting={disconnecting}
      />
    </div>
  );
}
