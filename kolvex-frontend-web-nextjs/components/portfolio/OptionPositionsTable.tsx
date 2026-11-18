"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Lock, Eye, EyeOff } from "lucide-react";
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
import MiniSparkline from "@/components/common/MiniSparkline";
import { formatCurrency } from "@/lib/portfolioApi";
import { marketStockHref } from "@/lib/stockLinks";
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

  // Plaid option positions are stored as total contract cost
  // (average option premium * 100). Portfolio-style payloads can be
  // per-share premium, so normalize before calculating P&L.
  const looksLikeContractCost =
    rawAveragePrice > 50 || (currentPremium > 0 && rawAveragePrice > currentPremium * 10);
  const premiumPerShare = looksLikeContractCost
    ? rawAveragePrice / OPTION_CONTRACT_MULTIPLIER
    : rawAveragePrice;

  return {
    premiumPerShare,
    costPerContract: premiumPerShare * OPTION_CONTRACT_MULTIPLIER,
  };
}

/** Contract count, cost, value and P&L for one option position (shared by table and phone cards). */
function optionFigures(pos: PortfolioPosition) {
  const safePrice = isHiddenValue(pos.price) ? 0 : (pos.price as number);
  const safeAvgPrice = isHiddenValue(pos.average_purchase_price)
    ? 0
    : (pos.average_purchase_price as number);

  const signedContracts = isHiddenValue(pos.units) ? 0 : Number(pos.units || 0);
  const contracts = Math.abs(signedContracts);
  const currentPremium = Math.abs(Number(safePrice || 0));
  const { costPerContract } = normalizeOptionCost(
    Math.abs(Number(safeAvgPrice || 0)),
    currentPremium,
  );
  const computedMarketValue = currentPremium * contracts * OPTION_CONTRACT_MULTIPLIER;
  const storedMarketValue = isHiddenValue(pos.market_value)
    ? 0
    : Math.abs(Number(pos.market_value || 0));
  const marketValue = computedMarketValue || storedMarketValue;
  const canShowMarketValue = computedMarketValue > 0 || !isHiddenValue(pos.market_value);
  const totalCost = costPerContract * contracts;
  const isShort = signedContracts < 0 || (!signedContracts && (pos.weight_percent ?? 0) < 0);
  // Short options profit when the premium falls. Long options profit when it rises.
  const pnl = isShort ? totalCost - marketValue : marketValue - totalCost;
  const pnlPerShare = contracts > 0 ? pnl / (contracts * OPTION_CONTRACT_MULTIPLIER) : 0;
  return {
    safePrice,
    contracts,
    costPerContract,
    marketValue,
    canShowMarketValue,
    isShort,
    pnl,
    profit: pnl >= 0,
    pnlPerShare,
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
  const { t } = useTranslation();

  if (positions.length === 0) return null;

  return (
    <>
      <div className="px-4 py-4 bg-primary/5 text-xs font-medium text-primary dark:text-primary-dark flex items-center border-y border-primary/30 dark:border-border-dark">
        {t("portfolio.table.optionsContracts")}
      </div>
      <OptionPositionsCards
        positions={positions}
        isOwner={isOwner}
        isPublic={isPublic}
        privacySettings={privacySettings}
        onToggleVisibility={onToggleVisibility}
      />
      <div className="hidden overflow-x-auto sm:block">
        <Table className="min-w-[68.75rem] [&_td]:py-2 [&_th]:h-9">
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
                className="w-[11.25rem] min-w-[11.25rem] pl-4"
              />
              <SortableHeader
                label={t("portfolio.table.expiration")}
                sortKey="expiration_date"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[5.625rem] min-w-[5.625rem]"
              />
              <TableHead className="w-[5rem] min-w-[5rem] hidden sm:table-cell text-center">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("portfolio.table.chart")}
                </span>
              </TableHead>
              <SortableHeader
                label={t("portfolio.table.strike")}
                sortKey="strike"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[10rem] min-w-[10rem]"
              />
              <SortableHeader
                label={t("portfolio.table.price")}
                sortKey="price"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[5rem] min-w-[5rem]"
              />
              <SortableHeader
                label={t("portfolio.table.cost")}
                sortKey="cost"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[5rem] min-w-[5rem]"
              />
              <SortableHeader
                label={t("portfolio.table.contracts")}
                sortKey="units"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="numeric"
                className="w-[5rem] min-w-[5rem]"
              />
              <SortableHeader
                label={t("portfolio.table.value")}
                sortKey="value"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="amount"
                className="w-[5rem] min-w-[5rem]"
              />
              <SortableHeader
                label={t("portfolio.table.totalPnl")}
                sortKey="pnl"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="amount"
                className="w-[5.625rem] min-w-[5.625rem]"
              />
              <SortableHeader
                label={t("portfolio.table.pnlPerShare")}
                sortKey="pnl_per_share"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="amount"
                className="w-[5.625rem] min-w-[5.625rem]"
              />
              <SortableHeader
                label={t("portfolio.table.weight")}
                sortKey="weight"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="numeric"
                className={`w-[4.375rem] min-w-[4.375rem] ${isOwner && isPublic ? "" : "pr-4"}`}
              />
              {isOwner && isPublic && (
                <TableHead className="w-[3.125rem] min-w-[3.125rem] pr-4">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {t("portfolio.table.public")}
                  </span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((pos: PortfolioPosition) => {
              const isHiddenPosition = pos.is_hidden || pos.units == null;
              const {
                safePrice,
                contracts,
                costPerContract,
                marketValue,
                canShowMarketValue,
                isShort,
                pnl,
                profit,
                pnlPerShare,
              } = optionFigures(pos);
              const pnlPerShareProfit = pnlPerShare >= 0;
              // Privacy: per-share PnL visibility (owner always sees, public checks setting)
              const showPnlPerShare =
                isOwner || privacySettings?.show_position_pnl_per_share !== false;
              const showPnl = isOwner || privacySettings?.show_position_pnl !== false;

              // Whether to completely hide (secret option)
              const isSecretOption = isHiddenPosition && !isOwner;

              return (
                <TableRow
                  key={pos.id}
                  className={`${
                    isSecretOption ? "opacity-70" : "hover:bg-foreground/[0.06]"
                  } transition-colors`}
                >
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      {isSecretOption ? (
                        <div className="w-8 h-8 rounded-2xl bg-muted/80 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <Link
                          href={marketStockHref(pos.underlying_symbol || pos.symbol)}
                          aria-label={pos.underlying_symbol || pos.symbol}
                          className="rounded-2xl underline-offset-4 hover:opacity-90 focus-visible:outline-none "
                        >
                          <CompanyLogo
                            symbol={pos.underlying_symbol || pos.symbol}
                            name={pos.security_name || pos.underlying_symbol || pos.symbol}
                            size="sm"
                            border="light"
                          />
                        </Link>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold flex items-center gap-1.5">
                          {isSecretOption ? (
                            <span className="text-muted-foreground">***</span>
                          ) : (
                            <Link
                              href={marketStockHref(pos.underlying_symbol || pos.symbol)}
                              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none "
                            >
                              {pos.underlying_symbol || pos.symbol}
                            </Link>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[9.375rem]">
                          {pos.security_name}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {isSecretOption ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      <span className="text-[0.75rem] text-muted-foreground">
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
                          data={sparklineDataMap.get(pos.underlying_symbol || pos.symbol) || []}
                          width={80}
                          height={20}
                          strokeWidth={1.2}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums w-[10rem] min-w-[10rem]">
                    <div className="flex justify-center items-center gap-1 whitespace-nowrap">
                      {isSecretOption ? (
                        <span className="text-muted-foreground">***</span>
                      ) : pos.strike_price ? (
                        <div className="flex items-center gap-1 text-[0.875rem]">
                          <Badge
                            variant={isShort ? "destructive" : "default"}
                            className="!text-[0.75rem] shrink-0"
                          >
                            {isShort ? t("portfolio.table.short") : t("portfolio.table.long")}
                          </Badge>
                          {formatCurrency(pos.strike_price, "USD", 0, 0)} {pos.option_type || "-"}
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
                    {isSecretOption ||
                    !showPnl ||
                    isHiddenValue(pos.average_purchase_price) ||
                    isHiddenValue(pos.price) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${
                          profit ? "text-positive" : "text-negative"
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
                    {isSecretOption ||
                    !showPnlPerShare ||
                    isHiddenValue(pos.price) ||
                    isHiddenValue(pos.average_purchase_price) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${
                          pnlPerShareProfit ? "text-positive" : "text-negative"
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
                  <TableCell className={`text-right ${isOwner && isPublic ? "" : "pr-4"}`}>
                    {isSecretOption || isHiddenValue(pos.weight_percent) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      <WeightIndicator percent={Math.abs(pos.weight_percent || 0)} />
                    )}
                  </TableCell>
                  {isOwner && isPublic && (
                    <TableCell className="text-center pr-4">
                      <button
                        onClick={(e) => onToggleVisibility(e, pos.id, pos.is_hidden || false)}
                        className={`p-1.5 rounded-full transition-colors ${
                          pos.is_hidden
                            ? "text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
                            : "text-positive hover:text-positive hover:bg-positive/10"
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

/** Phone layout: one row per contract instead of an 11-column table that scrolls sideways. */
function OptionPositionsCards({
  positions,
  isOwner,
  isPublic,
  privacySettings,
  onToggleVisibility,
}: Pick<
  OptionPositionsTableProps,
  "positions" | "isOwner" | "isPublic" | "privacySettings" | "onToggleVisibility"
>) {
  const { t } = useTranslation();

  return (
    <ul className="divide-y divide-border sm:hidden">
      {positions.map((pos: PortfolioPosition) => {
        const isSecret = (pos.is_hidden || pos.units == null) && !isOwner;
        const f = optionFigures(pos);
        const symbol = pos.underlying_symbol || pos.symbol;
        const showPnl = isOwner || privacySettings?.show_position_pnl !== false;
        const pnlHidden =
          isSecret ||
          !showPnl ||
          isHiddenValue(pos.average_purchase_price) ||
          isHiddenValue(pos.price);
        const money = (val: number, hidden: boolean) =>
          isSecret || hidden ? "***" : formatCurrency(val);

        return (
          <li
            key={pos.id}
            className={`flex items-start gap-3 px-4 py-3 ${isSecret ? "opacity-70" : ""}`}
          >
            {isSecret ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-muted/80">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <Link href={marketStockHref(symbol)} aria-label={symbol} className="shrink-0">
                <CompanyLogo
                  symbol={symbol}
                  name={pos.security_name || symbol}
                  size="sm"
                  border="light"
                />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1.5 font-semibold">
                  {isSecret ? (
                    <span className="text-muted-foreground">***</span>
                  ) : (
                    <Link href={marketStockHref(symbol)} className="truncate">
                      {symbol}
                    </Link>
                  )}
                  {!isSecret && pos.strike_price ? (
                    <Badge
                      variant={f.isShort ? "destructive" : "default"}
                      size="xxs"
                      className="shrink-0 !text-[0.625rem]"
                    >
                      {f.isShort ? t("portfolio.table.short") : t("portfolio.table.long")}
                    </Badge>
                  ) : null}
                </div>
                <span className="shrink-0 font-medium tabular-nums">
                  {money(f.marketValue, !f.canShowMarketValue)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate tabular-nums text-muted-foreground">
                  {isSecret
                    ? "***"
                    : [
                        pos.strike_price
                          ? `${formatCurrency(pos.strike_price, "USD", 0, 0)} ${pos.option_type || ""}`.trim()
                          : null,
                        pos.expiration_date,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "-"}
                </span>
                {pnlHidden ? (
                  <span className="shrink-0 text-muted-foreground">***</span>
                ) : (
                  <span
                    className={`inline-flex shrink-0 items-center gap-0.5 font-medium tabular-nums ${
                      f.profit ? "text-positive" : "text-negative"
                    }`}
                  >
                    {f.profit ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {f.profit ? "+" : "−"}
                    {formatCurrency(Math.abs(f.pnl))}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                <span>
                  {t("portfolio.table.contracts")}{" "}
                  {isSecret || isHiddenValue(pos.units) ? "***" : f.contracts}
                </span>
                <span>
                  {t("portfolio.table.price")} {money(f.safePrice, isHiddenValue(pos.price))}
                </span>
                <span>
                  {t("portfolio.table.cost")}{" "}
                  {money(f.costPerContract, isHiddenValue(pos.average_purchase_price))}
                </span>
              </div>
            </div>
            {isOwner && isPublic && (
              <button
                onClick={(e) => onToggleVisibility(e, pos.id, pos.is_hidden || false)}
                className={`-mr-1.5 shrink-0 rounded-full p-2 transition-colors ${
                  pos.is_hidden ? "text-muted-foreground" : "text-positive"
                }`}
                aria-label={
                  pos.is_hidden
                    ? t("portfolio.table.hiddenFromPublic")
                    : t("portfolio.table.visibleToPublic")
                }
              >
                {pos.is_hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
