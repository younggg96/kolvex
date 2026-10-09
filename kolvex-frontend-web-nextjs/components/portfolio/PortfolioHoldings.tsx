"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AlertCircle, Clock } from "lucide-react";
import { SwitchTab } from "@/components/ui/switch-tab";
import { EmptyState } from "@/components/common/EmptyState";
import { calculateTotalValue, calculateTotalPnL } from "@/lib/portfolioApi";
import { useTranslation } from "@/lib/i18n";
import { PortfolioSkeleton } from "./PortfolioSkeleton";
import { PortfolioStatsGrid } from "./PortfolioStatsGrid";
import { PortfolioHeaderActions } from "./PortfolioHeaderActions";
import { PortfolioPerformanceChart } from "./PortfolioPerformanceChart";
import { NotConnectedState, InitialSyncState } from "./ConnectionStates";
import { AccountCard } from "./AccountCard";
import { DisconnectDialog } from "./DisconnectDialog";
import { PortfolioAIAnalysis } from "./PortfolioAIAnalysis";
import { InvestmentTransactionsTable } from "./InvestmentTransactionsTable";
import { usePortfolioData } from "./hooks/usePortfolioData";
import { useEquitySort, useOptionSort } from "./hooks/usePortfolioSort";
import {
  useStockDataCache,
  usePortfolioSymbols,
} from "./hooks/useStockDataCache";
import { downloadHoldings } from "./utils/downloadHoldings";
import type { PortfolioHoldingsProps } from "./types";

export type { PortfolioHeaderActionsProps } from "./PortfolioHeaderActions";

export default function PortfolioHoldings({
  userId,
  isOwner = false,
  onHeaderActionsReady,
  renderAfterSummary,
}: PortfolioHoldingsProps) {
  const { t } = useTranslation();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    new Set(),
  );
  const [activeTab, setActiveTab] = useState<
    "holdings" | "transactions" | "ai-insights"
  >("holdings");
  const [sparklineDataMap, setSparklineDataMap] = useState<
    Map<string, number[]>
  >(new Map());

  const {
    status,
    holdings,
    transactions,
    transactionsTotal,
    transactionsHasMore,
    transactionSymbolFilter,
    loadingTransactions,
    loading,
    syncing,
    connecting,
    disconnecting,
    copied,
    handleConnectPlaid,
    handleLoadMoreTransactions,
    handleTransactionSymbolFilterChange,
    handleSyncTransactions,
    handleSync,
    handleTogglePublic,
    handleDisconnect,
    handleCopyShareLink,
    handleTogglePositionVisibility,
  } = usePortfolioData({ userId, isOwner });

  const equitySort = useEquitySort();
  const optionSort = useOptionSort();
  const { fetchSparklines, lastRefreshTime } =
    useStockDataCache();
  const portfolioSymbols = usePortfolioSymbols(holdings?.accounts);

  const tabOptions = useMemo(
    () => [
      { value: "holdings", label: t("portfolio.tabs.holdings") },
      ...(isOwner
        ? [{ value: "transactions", label: t("portfolio.tabs.transactions") }]
        : []),
      { value: "ai-insights", label: t("portfolio.tabs.aiInsights") },
    ],
    [isOwner, t],
  );

  const handleDownload = useCallback(
    (format: "csv" | "json") => {
      if (holdings) downloadHoldings(holdings, format);
    },
    [holdings],
  );

  const handleDisconnectAndClose = useCallback(async () => {
    const success = await handleDisconnect();
    if (success) setDisconnectDialogOpen(false);
  }, [handleDisconnect]);

  useEffect(() => {
    if (holdings?.accounts) {
      const accountsWithPositions = holdings.accounts
        .filter((account) => (account.portfolio_positions?.length || 0) > 0)
        .map((account) => account.id);
      setExpandedAccounts(new Set(accountsWithPositions));
    }
  }, [holdings?.accounts]);

  const equityTickers = useMemo(
    () => [
      ...new Set(
        (holdings?.accounts ?? [])
          .flatMap((account) => account.portfolio_positions || [])
          .filter((position) => position.position_type !== "option")
          .map((position) => position.symbol.trim().toUpperCase()),
      ),
    ],
    [holdings?.accounts],
  );

  const symbolsKey = useMemo(
    () => portfolioSymbols.sort().join(","),
    [portfolioSymbols],
  );

  useEffect(() => {
    if (portfolioSymbols.length === 0) return;
    let cancelled = false;

    const fetchData = async () => {
      const sparklines = await fetchSparklines(portfolioSymbols, false);
      if (!cancelled) setSparklineDataMap(sparklines);
    };

    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, fetchSparklines]);

  const formatLastRefresh = useMemo(() => {
    if (!lastRefreshTime) return null;
    const diffMs = Date.now() - lastRefreshTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return t("common.justNow");
    if (diffMins < 60) return `${diffMins}m`;
    return `${diffHours}h`;
  }, [lastRefreshTime, t]);

  useEffect(() => {
    if (!onHeaderActionsReady) return;
    if (isOwner && status?.is_connected) {
      onHeaderActionsReady({
        holdings,
        onTogglePublic: handleTogglePublic,
        onCopyShareLink: handleCopyShareLink,
        copied,
        onConnect: handleConnectPlaid,
        onDisconnect: () => setDisconnectDialogOpen(true),
        onDownload: handleDownload,
      });
    } else {
      onHeaderActionsReady(null);
    }
  }, [
    onHeaderActionsReady,
    isOwner,
    status?.is_connected,
    holdings,
    copied,
    handleTogglePublic,
    handleCopyShareLink,
    handleConnectPlaid,
    handleDownload,
  ]);

  const toggleAccount = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

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
        (acc, curr) => acc + (curr.portfolio_positions?.length || 0),
        0,
      ) || 0
    : publicHoldings?.positions_count ?? 0;

  if (loading) return <PortfolioSkeleton />;

  if (!status?.is_connected) {
    return (
      <NotConnectedState
        onConnectPlaid={handleConnectPlaid}
        connecting={connecting}
      />
    );
  }

  if (status.accounts_count === 0) {
    return <InitialSyncState onSync={handleSync} syncing={syncing} />;
  }

  return (
    <div className="space-y-6">
      {isOwner && !onHeaderActionsReady && status?.is_connected && (
        <PortfolioHeaderActions
          holdings={holdings}
          onTogglePublic={handleTogglePublic}
          onCopyShareLink={handleCopyShareLink}
          copied={copied}
          onConnect={handleConnectPlaid}
          onDisconnect={() => setDisconnectDialogOpen(true)}
          onDownload={handleDownload}
        />
      )}

      {holdings?.accounts && holdings.accounts.length > 0 && userId && (
        <PortfolioPerformanceChart
          userId={userId}
          isOwner={isOwner}
          liveValue={totalValue}
          livePnL={
            isOwner || holdings?.privacy_settings?.show_total_pnl
              ? totalPnL
              : "***"
          }
          livePnlPercent={
            isOwner || holdings?.privacy_settings?.show_pnl_percent
              ? pnlPercent
              : "***"
          }
        />
      )}

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
        showTotalValue={!isOwner || !holdings?.accounts?.length}
      />

      {renderAfterSummary?.(equityTickers)}

      {holdings?.accounts && holdings.accounts.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-4">
            <SwitchTab
              options={tabOptions}
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(
                  value as
                    | "holdings"
                    | "transactions"
                    | "ai-insights",
                )
              }
              variant="underline"
              size="md"
              className="!w-fit"
            />

            {formatLastRefresh && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatLastRefresh}
              </span>
            )}
          </div>

          {activeTab === "holdings" && (
            <div className="space-y-2">
              {holdings.accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  isExpanded={expandedAccounts.has(account.id)}
                  onToggle={() => toggleAccount(account.id)}
                  isOwner={isOwner}
                  isPublic={holdings.is_public || false}
                  privacySettings={holdings.privacy_settings}
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

          {activeTab === "transactions" && isOwner && (
            <InvestmentTransactionsTable
              transactions={transactions}
              total={transactionsTotal}
              hasMore={transactionsHasMore}
              loading={loadingTransactions}
              symbolFilter={transactionSymbolFilter}
              onSymbolFilterChange={handleTransactionSymbolFilterChange}
              onLoadMore={handleLoadMoreTransactions}
              onSync={handleSyncTransactions}
              syncing={syncing}
            />
          )}


          {activeTab === "ai-insights" && isOwner && <PortfolioAIAnalysis />}

          {activeTab === "ai-insights" && !isOwner && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t("portfolio.holdings.aiOnlyOwner")}</p>
            </div>
          )}
        </>
      )}

      {(!holdings?.accounts || holdings.accounts.length === 0) && (
        <EmptyState
          icon={AlertCircle}
          title={t("portfolio.holdings.noAccountData")}
          description={t("portfolio.holdings.noAccountDataDesc")}
          action={{
            label: syncing
              ? t("portfolio.connect.syncing")
              : t("portfolio.holdings.syncNow"),
            onClick: handleSync,
          }}
        />
      )}

      <DisconnectDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
        onDisconnect={handleDisconnectAndClose}
        disconnecting={disconnecting}
      />
    </div>
  );
}
