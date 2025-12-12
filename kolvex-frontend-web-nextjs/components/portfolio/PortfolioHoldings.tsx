"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Link2,
  Wallet,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  LogOut,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Briefcase,
  ChevronRight,
  Globe,
  Lock,
  BarChart3,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioSkeleton } from "./PortfolioSkeleton";
import { PortfolioStatsGrid } from "./PortfolioStatsGrid";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SortableHeader } from "@/components/ui/sortable-header";
import { EmptyState } from "@/components/common/EmptyState";
import CompanyLogo from "@/components/stock/CompanyLogo";
import MiniSparkline from "@/components/stock/MiniSparkline";

type EquitySortKey = "symbol" | "price" | "units" | "value" | "pnl";
type OptionSortKey = "symbol" | "type" | "strike" | "units" | "value" | "pnl";
import {
  getConnectionStatus,
  getConnectionPortalUrl,
  syncAccounts,
  syncPositions,
  getMyHoldings,
  togglePublicSharing,
  disconnectSnapTrade,
  calculateTotalValue,
  calculateTotalPnL,
  formatCurrency,
  formatPercent,
  getShareUrl,
} from "@/lib/snaptradeApi";
import type {
  SnapTradeConnectionStatus,
  SnapTradeHoldings,
  SnapTradePosition,
} from "@/lib/supabase/database.types";
import { PortfolioHeaderActions } from "./PortfolioHeaderActions";
import type { PortfolioHeaderActionsProps } from "./PortfolioHeaderActions";

export type { PortfolioHeaderActionsProps };

interface PortfolioHoldingsProps {
  userId?: string;
  isOwner?: boolean;
  onHeaderActionsReady?: (props: PortfolioHeaderActionsProps | null) => void;
}

export default function PortfolioHoldings({
  userId,
  isOwner = false,
  onHeaderActionsReady,
}: PortfolioHoldingsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SnapTradeConnectionStatus | null>(null);
  const [holdings, setHoldings] = useState<SnapTradeHoldings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    new Set()
  );
  const [equitySortKey, setEquitySortKey] = useState<EquitySortKey | null>(
    null
  );
  const [equitySortDir, setEquitySortDir] = useState<"asc" | "desc">("desc");
  const [optionSortKey, setOptionSortKey] = useState<OptionSortKey | null>(
    null
  );
  const [optionSortDir, setOptionSortDir] = useState<"asc" | "desc">("desc");
  const [sparklineDataMap, setSparklineDataMap] = useState<
    Map<string, number[]>
  >(new Map());

  // Load connection status and holdings data
  useEffect(() => {
    loadData();
  }, [userId]);

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
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isOwner) {
        const [statusData, holdingsData] = await Promise.all([
          getConnectionStatus(),
          getMyHoldings(),
        ]);
        setStatus(statusData);
        setHoldings(holdingsData);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/dashboard/portfolio?connected=true`;
      const url = await getConnectionPortalUrl(redirectUri);
      window.open(url, "_blank", "width=800,height=600");
      toast.info("Please complete the broker connection in the new window");
    } catch (error: any) {
      toast.error(error.message || "Failed to get connection link");
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAccounts();
      await syncPositions();
      await loadData();
      toast.success("Data synced successfully");
    } catch (error: any) {
      toast.error(error.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleTogglePublic = async (isPublic: boolean) => {
    try {
      await togglePublicSharing(isPublic);
      setHoldings((prev) => (prev ? { ...prev, is_public: isPublic } : null));
      toast.success(
        isPublic ? "Portfolio is now public" : "Portfolio is now private"
      );
    } catch (error: any) {
      toast.error(error.message || "Operation failed");
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectSnapTrade();
      setStatus(null);
      setHoldings(null);
      setDisconnectDialogOpen(false);
      toast.success("SnapTrade disconnected");
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!userId) return;
    const url = getShareUrl(userId);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

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

  const handleEquitySort = (key: EquitySortKey) => {
    if (equitySortKey === key) {
      // Same key clicked: desc -> asc -> clear
      if (equitySortDir === "desc") {
        setEquitySortDir("asc");
      } else {
        // Currently asc, third click clears sorting
        setEquitySortKey(null);
        setEquitySortDir("desc");
      }
    } else {
      // New key: start with desc
      setEquitySortKey(key);
      setEquitySortDir("desc");
    }
  };

  const handleOptionSort = (key: OptionSortKey) => {
    if (optionSortKey === key) {
      // Same key clicked: desc -> asc -> clear
      if (optionSortDir === "desc") {
        setOptionSortDir("asc");
      } else {
        // Currently asc, third click clears sorting
        setOptionSortKey(null);
        setOptionSortDir("desc");
      }
    } else {
      // New key: start with desc
      setOptionSortKey(key);
      setOptionSortDir("desc");
    }
  };

  const sortEquityPositions = (positions: SnapTradePosition[]) => {
    if (!equitySortKey) return positions;
    return [...positions].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (equitySortKey) {
        case "symbol":
          aVal = a.symbol || "";
          bVal = b.symbol || "";
          break;
        case "price":
          aVal = a.price || 0;
          bVal = b.price || 0;
          break;
        case "units":
          aVal = a.units || 0;
          bVal = b.units || 0;
          break;
        case "value":
          aVal = (a.price || 0) * a.units;
          bVal = (b.price || 0) * b.units;
          break;
        case "pnl":
          aVal = a.open_pnl || 0;
          bVal = b.open_pnl || 0;
          break;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return equitySortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return equitySortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  };

  const sortOptionPositions = (positions: SnapTradePosition[]) => {
    if (!optionSortKey) return positions;
    return [...positions].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (optionSortKey) {
        case "symbol":
          aVal = a.underlying_symbol || a.symbol || "";
          bVal = b.underlying_symbol || b.symbol || "";
          break;
        case "type":
          // Sort by expiration date (earliest first for asc)
          aVal = a.expiration_date ? new Date(a.expiration_date).getTime() : 0;
          bVal = b.expiration_date ? new Date(b.expiration_date).getTime() : 0;
          break;
        case "strike":
          aVal = a.strike_price || 0;
          bVal = b.strike_price || 0;
          break;
        case "units":
          aVal = a.units || 0;
          bVal = b.units || 0;
          break;
        case "value":
          aVal = (a.price || 0) * a.units * 100;
          bVal = (b.price || 0) * b.units * 100;
          break;
        case "pnl":
          const aCost = (a.average_purchase_price || 0) * a.units;
          const bCost = (b.average_purchase_price || 0) * b.units;
          aVal = (a.price || 0) * a.units * 100 - aCost;
          bVal = (b.price || 0) * b.units * 100 - bCost;
          break;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return optionSortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return optionSortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  };

  // Calculate summary data
  const totalValue = holdings ? calculateTotalValue(holdings) : 0;
  const totalPnL = holdings ? calculateTotalPnL(holdings) : 0;
  const pnlPercent =
    totalValue > 0 ? (totalPnL / (totalValue - totalPnL)) * 100 : 0;
  const totalPositions =
    holdings?.accounts?.reduce(
      (acc, curr) => acc + (curr.snaptrade_positions?.length || 0),
      0
    ) || 0;

  if (loading) {
    return <PortfolioSkeleton />;
  }

  // State 1: Not registered
  if (!status?.is_registered) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center space-y-8 p-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Link2 className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">Connect Your Broker</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Link your brokerage account to automatically track your positions,
              monitor performance, and share your portfolio publicly.
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleConnect}
            disabled={connecting}
            className="w-full gap-2"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {connecting ? "Connecting..." : "Connect Broker"}
          </Button>
          <div className="flex justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-green-500" /> Secure
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-green-500" /> Read-only
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-green-500" /> Encrypted
            </span>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Registered but not synced
  if (!status?.is_connected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center space-y-8 p-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">Broker Connected!</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Great! Your account is linked. Sync now to import your current
              positions and start tracking.
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleSync}
            disabled={syncing}
            className="w-full gap-2"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {syncing ? "Syncing..." : "Sync Positions"}
          </Button>
        </div>
      </div>
    );
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
        />
      )}

      {/* Stats Grid */}
      <PortfolioStatsGrid
        totalValue={totalValue}
        totalPnL={totalPnL}
        pnlPercent={pnlPercent}
        totalPositions={totalPositions}
        accountsCount={holdings?.accounts?.length || 0}
      />

      {/* Holdings List */}
      <div className="space-y-2">
        {holdings?.accounts?.map((account) => {
          const equityPositions =
            account.snaptrade_positions?.filter(
              (p) => p.position_type !== "option"
            ) || [];
          const optionPositions =
            account.snaptrade_positions?.filter(
              (p) => p.position_type === "option"
            ) || [];
          const accountPositions = account.snaptrade_positions?.length || 0;
          const isExpanded = expandedAccounts.has(account.id);

          return (
            <Collapsible
              key={account.id}
              open={isExpanded}
              onOpenChange={() => toggleAccount(account.id)}
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                        <div>
                          <CardTitle className="text-sm font-semibold">
                            {account.account_name || "Brokerage Account"}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground font-mono">
                            {account.account_number
                              ? `•••• ${account.account_number.slice(-4)}`
                              : account.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {accountPositions} positions
                        </Badge>
                        {optionPositions.length > 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs border-primary/30 text-primary"
                          >
                            {optionPositions.length} options
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="!p-0 border-t dark:border-border-dark">
                    {/* Equities */}
                    {equityPositions.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <SortableHeader
                              label="Symbol"
                              sortKey="symbol"
                              currentSortKey={equitySortKey}
                              sortDirection={equitySortDir}
                              onSort={handleEquitySort}
                              align="left"
                              type="alpha"
                              className="w-[25%] pl-4"
                            />
                            <TableHead className="w-[80px] hidden sm:table-cell">
                              <span className="text-xs text-muted-foreground">
                                Chart
                              </span>
                            </TableHead>
                            <SortableHeader
                              label="Price"
                              sortKey="price"
                              currentSortKey={equitySortKey}
                              sortDirection={equitySortDir}
                              onSort={handleEquitySort}
                              align="right"
                              type="amount"
                            />
                            <SortableHeader
                              label="Shares"
                              sortKey="units"
                              currentSortKey={equitySortKey}
                              sortDirection={equitySortDir}
                              onSort={handleEquitySort}
                              align="center"
                              type="numeric"
                            />
                            <SortableHeader
                              label="Value"
                              sortKey="value"
                              currentSortKey={equitySortKey}
                              sortDirection={equitySortDir}
                              onSort={handleEquitySort}
                              align="right"
                              type="amount"
                            />
                            <SortableHeader
                              label="P&L"
                              sortKey="pnl"
                              currentSortKey={equitySortKey}
                              sortDirection={equitySortDir}
                              onSort={handleEquitySort}
                              align="right"
                              type="amount"
                              className="pr-4"
                            />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortEquityPositions(equityPositions).map(
                            (pos: SnapTradePosition) => {
                              const value = (pos.price || 0) * pos.units;
                              const pnl = pos.open_pnl || 0;
                              const profit = pnl >= 0;

                              return (
                                <TableRow
                                  key={pos.id}
                                  onClick={() =>
                                    router.push(
                                      `/dashboard/stock/${pos.symbol}`
                                    )
                                  }
                                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                                >
                                  <TableCell className="pl-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <CompanyLogo
                                        symbol={pos.symbol}
                                        name={pos.security_name || pos.symbol}
                                        size="sm"
                                        shape="rounded"
                                        border="light"
                                      />
                                      <div className="min-w-0">
                                        <div className="font-semibold">
                                          {pos.symbol}
                                        </div>
                                        <div
                                          className="text-xs text-muted-foreground truncate max-w-[150px]"
                                          title={pos.security_name || ""}
                                        >
                                          {pos.security_name}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <div className="flex justify-center">
                                      <MiniSparkline
                                        data={
                                          sparklineDataMap.get(pos.symbol) || []
                                        }
                                        width={80}
                                        height={20}
                                        strokeWidth={1.2}
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {pos.price
                                      ? formatCurrency(pos.price)
                                      : "-"}
                                  </TableCell>

                                  <TableCell className="text-center tabular-nums">
                                    {pos.units}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums font-medium">
                                    {formatCurrency(value)}
                                  </TableCell>
                                  <TableCell className="text-right pr-4">
                                    <span
                                      className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${
                                        profit
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {profit ? (
                                        <ArrowUpRight className="w-3 h-3" />
                                      ) : (
                                        <ArrowDownRight className="w-3 h-3" />
                                      )}
                                      {formatCurrency(Math.abs(pnl))}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                          )}
                        </TableBody>
                      </Table>
                    )}

                    {/* Options */}
                    {optionPositions.length > 0 && (
                      <>
                        <div className="px-4 py-4 bg-primary/5 text-xs font-medium text-primary dark:text-primary-dark flex items-center border-y border-primary/30 dark:border-border-dark">
                          Options Contracts
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <SortableHeader
                                label="Contract"
                                sortKey="symbol"
                                currentSortKey={optionSortKey}
                                sortDirection={optionSortDir}
                                onSort={handleOptionSort}
                                align="left"
                                type="alpha"
                                className="w-[15%] pl-4"
                              />
                              <SortableHeader
                                label="Type"
                                sortKey="type"
                                currentSortKey={optionSortKey}
                                sortDirection={optionSortDir}
                                onSort={handleOptionSort}
                                align="center"
                                type="amount"
                              />
                              <TableHead className="w-[80px] hidden sm:table-cell">
                                <span className="text-xs text-muted-foreground">
                                  Chart
                                </span>
                              </TableHead>
                              <SortableHeader
                                label="Strike"
                                sortKey="strike"
                                currentSortKey={optionSortKey}
                                sortDirection={optionSortDir}
                                onSort={handleOptionSort}
                                align="right"
                                type="amount"
                              />
                              <SortableHeader
                                label="Shares"
                                sortKey="units"
                                currentSortKey={optionSortKey}
                                sortDirection={optionSortDir}
                                onSort={handleOptionSort}
                                align="center"
                                type="numeric"
                              />
                              <SortableHeader
                                label="Value"
                                sortKey="value"
                                currentSortKey={optionSortKey}
                                sortDirection={optionSortDir}
                                onSort={handleOptionSort}
                                align="center"
                                type="amount"
                              />
                              <SortableHeader
                                label="P&L"
                                sortKey="pnl"
                                currentSortKey={optionSortKey}
                                sortDirection={optionSortDir}
                                onSort={handleOptionSort}
                                align="right"
                                type="amount"
                                className="pr-4"
                              />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortOptionPositions(optionPositions).map(
                              (pos: SnapTradePosition) => {
                                const value =
                                  (pos.price || 0) * pos.units * 100;
                                // Calculate option P&L: current value - cost basis
                                // average_purchase_price is the total cost per contract
                                const cost =
                                  (pos.average_purchase_price || 0) * pos.units;
                                const pnl = pos.open_pnl || value - cost;
                                const profit = pnl >= 0;
                                const isCall = pos.option_type === "call";

                                return (
                                  <TableRow
                                    key={pos.id}
                                    onClick={() =>
                                      router.push(
                                        `/dashboard/stock/${
                                          pos.underlying_symbol || pos.symbol
                                        }`
                                      )
                                    }
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                  >
                                    <TableCell className="pl-4 py-3">
                                      <div className="flex items-center gap-2.5">
                                        <CompanyLogo
                                          symbol={
                                            pos.underlying_symbol || pos.symbol
                                          }
                                          name={
                                            pos.security_name ||
                                            pos.underlying_symbol ||
                                            pos.symbol
                                          }
                                          size="sm"
                                          shape="rounded"
                                          border="light"
                                        />
                                        <div className="min-w-0">
                                          <div className="font-semibold">
                                            {pos.underlying_symbol ||
                                              pos.symbol}
                                          </div>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex justify-center items-center gap-1">
                                        <Badge
                                          variant={
                                            isCall ? "default" : "destructive"
                                          }
                                          className="!text-[10px] !px-1.5 !py-0.5 capitalize"
                                        >
                                          {pos.option_type || "-"}
                                        </Badge>
                                        <span className="text-[12px] text-muted-foreground">
                                          {pos.expiration_date
                                            ? new Date(
                                                pos.expiration_date
                                              ).toLocaleDateString()
                                            : "-"}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                      <div className="flex justify-center">
                                        <MiniSparkline
                                          data={
                                            sparklineDataMap.get(
                                              pos.underlying_symbol ||
                                                pos.symbol
                                            ) || []
                                          }
                                          width={80}
                                          height={20}
                                          strokeWidth={1.2}
                                        />
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {pos.strike_price
                                        ? formatCurrency(pos.strike_price)
                                        : "-"}
                                    </TableCell>
                                    <TableCell className="text-center tabular-nums">
                                      {pos.units}
                                    </TableCell>
                                    <TableCell className="text-center tabular-nums font-medium">
                                      {formatCurrency(value)}
                                    </TableCell>
                                    <TableCell className="text-right pr-4">
                                      <span
                                        className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${
                                          profit
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }`}
                                      >
                                        {profit ? (
                                          <ArrowUpRight className="w-3 h-3" />
                                        ) : (
                                          <ArrowDownRight className="w-3 h-3" />
                                        )}
                                        {formatCurrency(Math.abs(pnl))}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                            )}
                          </TableBody>
                        </Table>
                      </>
                    )}

                    {/* Empty */}
                    {accountPositions === 0 && (
                      <EmptyState
                        icon={Briefcase}
                        title="No Positions"
                        description="This account has no active positions"
                      />
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

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
      </div>

      {/* Disconnect Dialog */}
      <Dialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect Broker?</DialogTitle>
            <DialogDescription>
              This will remove the connection and delete all synced data. You&apos;ll
              need to reconnect to view holdings again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDisconnectDialogOpen(false)}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="gap-2"
            >
              {disconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
