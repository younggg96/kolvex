"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowLeft,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SortableHeader } from "@/components/ui/sortable-header";
import { EmptyState } from "@/components/common/EmptyState";
import CompanyLogo from "@/components/stock/CompanyLogo";
import MiniSparkline from "@/components/stock/MiniSparkline";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  getPublicHoldings,
  formatCurrency,
  formatPercent,
  calculateTotalValue,
  calculateTotalPnL,
} from "@/lib/snaptradeApi";
import type {
  SnapTradePublicHoldings,
  SnapTradePosition,
} from "@/lib/supabase/database.types";

type EquitySortKey = "symbol" | "price" | "units" | "value" | "pnl";
type OptionSortKey = "symbol" | "type" | "strike" | "units" | "value" | "pnl";

export default function PublicPortfolioPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [holdings, setHoldings] = useState<SnapTradePublicHoldings | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    loadHoldings();
  }, [userId]);

  // Expand accounts with positions by default
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

  const loadHoldings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPublicHoldings(userId);
      if (!data) {
        setError(
          "This user has not shared their portfolio or is not connected to SnapTrade"
        );
      } else {
        setHoldings(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
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
      if (equitySortDir === "desc") {
        setEquitySortDir("asc");
      } else {
        setEquitySortKey(null);
        setEquitySortDir("desc");
      }
    } else {
      setEquitySortKey(key);
      setEquitySortDir("desc");
    }
  };

  const handleOptionSort = (key: OptionSortKey) => {
    if (optionSortKey === key) {
      if (optionSortDir === "desc") {
        setOptionSortDir("asc");
      } else {
        setOptionSortKey(null);
        setOptionSortDir("desc");
      }
    } else {
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
  const totalValue = holdings
    ? calculateTotalValue(
        holdings as unknown as Parameters<typeof calculateTotalValue>[0]
      )
    : 0;
  const totalPnL = holdings
    ? calculateTotalPnL(
        holdings as unknown as Parameters<typeof calculateTotalPnL>[0]
      )
    : 0;
  const pnlPercent =
    totalValue > 0 ? (totalPnL / (totalValue - totalPnL)) * 100 : 0;
  const totalPositions =
    holdings?.accounts?.reduce(
      (acc, curr) => acc + (curr.snaptrade_positions?.length || 0),
      0
    ) || 0;

  if (loading) {
    return (
      <DashboardLayout title="Shared Portfolio">
        <div className="p-2">
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Shared Portfolio">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Unable to View Portfolio
              </h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Shared Portfolio">
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 min-w-0 space-y-2">
          {/* Last Updated */}
          <div className="text-xs text-muted-foreground text-right">
            {holdings?.last_synced_at
              ? `Last updated: ${new Date(
                  holdings.last_synced_at
                ).toLocaleString()}`
              : ""}
          </div>

          {/* Stats Grid */}
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden">
              <CardContent className="!p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Value
                  </p>
                  <Wallet className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <p className="text-2xl font-bold mt-2 tabular-nums">
                  {formatCurrency(totalValue)}
                </p>
              </CardContent>
            </Card>

            <Card
              className={`relative overflow-hidden ${
                totalPnL >= 0 ? "bg-green-500/5" : "bg-red-500/5"
              }`}
            >
              <CardContent className="!p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Unrealized P&L
                  </p>
                  {totalPnL >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <p
                  className={`text-2xl font-bold mt-2 tabular-nums ${
                    totalPnL >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {totalPnL >= 0 ? "+" : ""}
                  {formatCurrency(totalPnL)}
                </p>
                <p
                  className={`text-xs mt-1 ${
                    pnlPercent >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {pnlPercent >= 0 ? "+" : ""}
                  {formatPercent(pnlPercent)} all time
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="!p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Positions
                  </p>
                  <BarChart3 className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <p className="text-2xl font-bold mt-2 tabular-nums">
                  {totalPositions}
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="!p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Accounts
                  </p>
                  <Briefcase className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <p className="text-2xl font-bold mt-2 tabular-nums">
                  {holdings?.accounts?.length || 0}
                </p>
              </CardContent>
            </Card>
          </div>

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
                                            name={
                                              pos.security_name || pos.symbol
                                            }
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
                                              sparklineDataMap.get(
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
                                    const cost =
                                      (pos.average_purchase_price || 0) *
                                      pos.units;
                                    const pnl = pos.open_pnl || value - cost;
                                    const profit = pnl >= 0;
                                    const isCall = pos.option_type === "call";

                                    return (
                                      <TableRow
                                        key={pos.id}
                                        onClick={() =>
                                          router.push(
                                            `/dashboard/stock/${
                                              pos.underlying_symbol ||
                                              pos.symbol
                                            }`
                                          )
                                        }
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                      >
                                        <TableCell className="pl-4 py-3">
                                          <div className="flex items-center gap-2.5">
                                            <CompanyLogo
                                              symbol={
                                                pos.underlying_symbol ||
                                                pos.symbol
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
                                                isCall
                                                  ? "default"
                                                  : "destructive"
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
                description="This user has not synced any holdings data yet"
              />
            )}
          </div>

          {/* Footer note */}
          <div className="text-center text-sm text-muted-foreground pt-4">
            <p>
              Data securely synced via{" "}
              <a
                href="https://snaptrade.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                SnapTrade
              </a>
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
