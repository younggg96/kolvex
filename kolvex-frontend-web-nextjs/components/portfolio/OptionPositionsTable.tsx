"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import CompanyLogo from "@/components/ui/company-logo";
import { WeightIndicator } from "@/components/ui/weight-indicator";
import MiniSparkline from "@/components/stock/MiniSparkline";
import { formatCurrency } from "@/lib/portfolioApi";
import { useTranslation } from "@/lib/i18n";
import type { OptionPositionsTableProps, PortfolioPosition } from "./types";

// Helper to check if a value is hidden
const isHiddenValue = (val: any): val is string =>
  val === "***" || val === null || val === undefined;

const OPTION_CONTRACT_MULTIPLIER = 100;

function normalizeOptionCost(rawAveragePrice: number, currentPremium: number) {
  if (!Number.isFinite(rawAveragePrice) || rawAveragePrice <= 0) {
    return { premiumPerShare: 0, costPerContract: 0 };
  }

  // Robinhood option positions are stored as total contract cost
  // (average option premium * 100). Portfolio-style payloads can be
  // per-share premium, so normalize before calculating P&L.
  const looksLikeContractCost =
    rawAveragePrice > 50 ||
    (currentPremium > 0 && rawAveragePrice > currentPremium * 10);
  const premiumPerShare = looksLikeContractCost
    ? rawAveragePrice / OPTION_CONTRACT_MULTIPLIER
    : rawAveragePrice;

  return {
    premiumPerShare,
    costPerContract: premiumPerShare * OPTION_CONTRACT_MULTIPLIER,
  };
}

export function OptionPositionsTable({
  positions,
  isOwner,
  isPublic,
  privacySettings,
  sortKey,
  sortDir,
  onSort,
  sparklineDataMap,
  onToggleVisibility,
}: OptionPositionsTableProps) {
  const router = useRouter();
  const { t } = useTranslation();

  if (positions.length === 0) return null;

  return (
    <>
      <div className="px-4 py-4 bg-primary/5 text-xs font-medium text-primary dark:text-primary-dark flex items-center border-y border-primary/30 dark:border-border-dark">
        {t("portfolio.table.optionsContracts")}
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <SortableHeader
                label={t("portfolio.table.symbol")}
                sortKey="symbol"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="left"
                type="alpha"
                className="w-[180px] min-w-[180px] pl-4"
              />
              <SortableHeader
                label={t("portfolio.table.expiration")}
                sortKey="expiration_date"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[90px] min-w-[90px]"
              />
              <TableHead className="w-[80px] min-w-[80px] hidden sm:table-cell text-center">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("portfolio.table.chart")}</span>
              </TableHead>
              <SortableHeader
                label={t("portfolio.table.strike")}
                sortKey="strike"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[160px] min-w-[160px]"
              />
              <SortableHeader
                label={t("portfolio.table.price")}
                sortKey="price"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[80px] min-w-[80px]"
              />
              <SortableHeader
                label={t("portfolio.table.cost")}
                sortKey="cost"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[80px] min-w-[80px]"
              />
              <SortableHeader
                label={t("portfolio.table.contracts")}
                sortKey="units"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="numeric"
                className="w-[80px] min-w-[80px]"
              />
              <SortableHeader
                label={t("portfolio.table.value")}
                sortKey="value"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[80px] min-w-[80px]"
              />
              <SortableHeader
                label={t("portfolio.table.totalPnl")}
                sortKey="pnl"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="amount"
                className="w-[90px] min-w-[90px]"
              />
              <SortableHeader
                label={t("portfolio.table.pnlPerShare")}
                sortKey="pnl_per_share"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="amount"
                className="w-[90px] min-w-[90px]"
              />
              <SortableHeader
                label={t("portfolio.table.weight")}
                sortKey="weight"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="numeric"
                className={`w-[70px] min-w-[70px] ${isOwner && isPublic ? "" : "pr-4"}`}
              />
              {isOwner && isPublic && (
                <TableHead className="w-[50px] min-w-[50px] pr-4">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{t("portfolio.table.public")}</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((pos: PortfolioPosition) => {
              const isHiddenPosition = pos.is_hidden || pos.units == null;

              // Safely get numeric values, handling hidden values "***"
              const safePrice = isHiddenValue(pos.price)
                ? 0
                : (pos.price as number);
              const safeAvgPrice = isHiddenValue(pos.average_purchase_price)
                ? 0
                : (pos.average_purchase_price as number);

              const signedContracts = isHiddenValue(pos.units)
                ? 0
                : Number(pos.units || 0);
              const contracts = Math.abs(signedContracts);
              const currentPremium = Math.abs(Number(safePrice || 0));
              const { costPerContract } =
                normalizeOptionCost(Math.abs(Number(safeAvgPrice || 0)), currentPremium);
              const computedMarketValue =
                currentPremium * contracts * OPTION_CONTRACT_MULTIPLIER;
              const storedMarketValue = isHiddenValue(pos.market_value)
                ? 0
                : Math.abs(Number(pos.market_value || 0));
              const marketValue = computedMarketValue || storedMarketValue;
              const canShowMarketValue =
                computedMarketValue > 0 || !isHiddenValue(pos.market_value);
              const totalCost = costPerContract * contracts;
              const isShort =
                signedContracts < 0 || (!signedContracts && (pos.weight_percent ?? 0) < 0);
              // Short options profit when the premium falls. Long options profit when it rises.
              const pnl = isShort ? totalCost - marketValue : marketValue - totalCost;
              const profit = pnl >= 0;
              const pnlPerShare =
                contracts > 0
                  ? pnl / (contracts * OPTION_CONTRACT_MULTIPLIER)
                  : 0;
              const pnlPerShareProfit = pnlPerShare >= 0;
              // Privacy: per-share PnL visibility (owner always sees, public checks setting)
              const showPnlPerShare = isOwner || privacySettings?.show_position_pnl_per_share !== false;
              const showPnl = isOwner || privacySettings?.show_position_pnl !== false;

              // Whether to completely hide (secret option)
              const isSecretOption = isHiddenPosition && !isOwner;

              return (
                <TableRow
                  key={pos.id}
                  className={`${isSecretOption ? "opacity-70" : "hover:bg-muted/50"
                    } transition-colors`}
                >
                  <TableCell className="pl-4 py-3 cursor-pointer" onClick={() =>
                    !isSecretOption &&
                    router.push(
                      `/dashboard/stock/${pos.underlying_symbol || pos.symbol}`
                    )
                  }>
                    <div className="flex items-center gap-2.5">
                      {isSecretOption ? (
                        <div className="w-8 h-8 rounded-lg bg-muted/80 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <CompanyLogo
                          symbol={pos.underlying_symbol || pos.symbol}
                          name={
                            pos.security_name ||
                            pos.underlying_symbol ||
                            pos.symbol
                          }
                          size="sm"
                          shape="rounded"
                          border="light"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold flex items-center gap-1.5">
                          {isSecretOption ? (
                            <span className="text-muted-foreground">***</span>
                          ) : (
                            pos.underlying_symbol || pos.symbol
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {pos.security_name}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {isSecretOption ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">
                        {pos.expiration_date ? pos.expiration_date : "-"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex justify-center">
                      {isSecretOption ? (
                        <div className="w-20 h-5 bg-muted/50 rounded" />
                      ) : (
                        <MiniSparkline
                          data={
                            sparklineDataMap.get(
                              pos.underlying_symbol || pos.symbol
                            ) || []
                          }
                          width={80}
                          height={20}
                          strokeWidth={1.2}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums w-[160px] min-w-[160px]">
                    <div className="flex justify-center items-center gap-1 whitespace-nowrap">
                      {isSecretOption ? (
                        <span className="text-muted-foreground">***</span>
                      ) : pos.strike_price ? (
                        <div className="flex items-center gap-1 text-[14px]">
                          <Badge
                            variant={
                              isShort
                                ? "destructive"
                                : "default"
                            }
                            className="!text-[12px] shrink-0"
                          >
                            {isShort ? t("portfolio.table.short") : t("portfolio.table.long")}
                          </Badge>
                          {formatCurrency(pos.strike_price, "USD", 0, 0)}{" "}
                          {pos.option_type || "-"}
                        </div>
                      ) : (
                        "-"
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums font-medium">
                    {isSecretOption || isHiddenValue(pos.price) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      formatCurrency(safePrice)
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-muted-foreground">
                    {isSecretOption || isHiddenValue(pos.average_purchase_price) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      formatCurrency(costPerContract)
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {isSecretOption || isHiddenValue(pos.units) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      contracts
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums font-medium">
                    {isSecretOption || !canShowMarketValue ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      formatCurrency(marketValue)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSecretOption || !showPnl || isHiddenValue(pos.average_purchase_price) || isHiddenValue(pos.price) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${profit ? "text-green-600" : "text-red-600"
                          }`}
                      >
                        {profit ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {formatCurrency(Math.abs(pnl))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSecretOption || !showPnlPerShare || isHiddenValue(pos.price) || isHiddenValue(pos.average_purchase_price) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${pnlPerShareProfit ? "text-green-600" : "text-red-600"
                          }`}
                      >
                        {pnlPerShareProfit ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {formatCurrency(Math.abs(pnlPerShare))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right ${isOwner && isPublic ? "" : "pr-4"}`}
                  >
                    {isSecretOption || isHiddenValue(pos.weight_percent) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      <WeightIndicator
                        percent={Math.abs(pos.weight_percent || 0)}
                      />
                    )}
                  </TableCell>
                  {isOwner && isPublic && (
                    <TableCell className="text-center pr-4">
                      <button
                        onClick={(e) =>
                          onToggleVisibility(e, pos.id, pos.is_hidden || false)
                        }
                        className={`p-1.5 rounded-md transition-colors ${pos.is_hidden
                          ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                          : "text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                          }`}
                        title={
                          pos.is_hidden
                            ? t("portfolio.table.hiddenFromPublic")
                            : t("portfolio.table.visibleToPublic")
                        }
                      >
                        {pos.is_hidden ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
