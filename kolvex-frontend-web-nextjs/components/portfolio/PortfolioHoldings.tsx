"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AlertCircle } from "lucide-react";
import { SwitchTab } from "@/components/ui/switch-tab";
import { EmptyState } from "@/components/common/EmptyState";
import { calculateTotalValue, calculateTotalPnL } from "@/lib/snaptradeApi";

// Local components
import { PortfolioSkeleton } from "./PortfolioSkeleton";
import { PortfolioStatsGrid } from "./PortfolioStatsGrid";
import { PortfolioAllocation } from "./PortfolioAllocation";
import { PortfolioHeaderActions } from "./PortfolioHeaderActions";
import { NotConnectedState, InitialSyncState } from "./ConnectionStates";
import { AccountCard } from "./AccountCard";
import { DisconnectDialog } from "./DisconnectDialog";

// Hooks
import { usePortfolioData } from "./hooks/usePortfolioData";
import { useEquitySort, useOptionSort } from "./hooks/usePortfolioSort";

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
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    new Set()
  );
  const [activeTab, setActiveTab] = useState<"holdings" | "analytics">(
    "holdings"
  );
  const [sparklineDataMap, setSparklineDataMap] = useState<
    Map<string, number[]>
  >(new Map());

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
    handleSync,
    handleTogglePublic,
    handleDisconnect,
    handleCopyShareLink,
    handleTogglePositionVisibility,
  } = usePortfolioData({ userId, isOwner });

  const equitySort = useEquitySort();
  const optionSort = useOptionSort();

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

  // Fetch intraday chart data for sparklines
  useEffect(() => {
    const fetchSparklineData = async () => {
      if (!holdings?.accounts) return;

      // Get unique symbols from all positions
      const symbols = new Set<string>();
      holdings.accounts.forEach((account) => {
        account.snaptrade_positions?.forEach((pos) => {
          const symbol =
            pos.position_type === "option"
              ? pos.underlying_symbol || pos.symbol
              : pos.symbol;
          if (symbol) symbols.add(symbol);
        });
      });

      const newMap = new Map<string, number[]>();

      await Promise.all(
        Array.from(symbols).map(async (symbol) => {
          try {
            const response = await fetch(
              `/api/stocks?action=chart&symbol=${symbol}&interval=5m`
            );
            if (response.ok) {
              const data = await response.json();
              const values = data.map((d: { value: number }) => d.value);
              newMap.set(symbol, values);
            }
          } catch (error) {
            console.error(`Failed to fetch sparkline for ${symbol}:`, error);
          }
        })
      );

      setSparklineDataMap(newMap);
    };

    fetchSparklineData();
  }, [holdings?.accounts]);

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
      <NotConnectedState onConnect={handleConnect} connecting={connecting} />
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

      {/* Tab Navigation */}
      {holdings?.accounts && holdings.accounts.length > 0 && (
        <>
          <SwitchTab
            options={[
              { value: "holdings", label: "Holdings" },
              { value: "analytics", label: "Analytics" },
            ]}
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "holdings" | "analytics")}
            variant="underline"
            size="md"
            className="!w-fit"
          />

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
            />
          )}
        </>
      )}

      {/* Empty State */}
      {(!holdings?.accounts || holdings.accounts.length === 0) && (
        <EmptyState
          icon={AlertCircle}
          title="No Account Data"
          description="Sync to fetch your latest positions from your connected broker"
          action={{
            label: syncing ? "Syncing..." : "Sync Now",
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
