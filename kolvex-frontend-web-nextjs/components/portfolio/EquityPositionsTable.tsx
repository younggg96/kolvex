"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Lock, Eye, EyeOff } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { WeightIndicator } from "@/components/ui/weight-indicator";
import MiniSparkline from "@/components/common/MiniSparkline";
import { equityOpenPnl, formatCurrency } from "@/lib/portfolioApi";
import { marketStockHref } from "@/lib/stockLinks";
import { useTranslation } from "@/lib/i18n";
import type { EquityPositionsTableProps, PortfolioPosition } from "./types";

// Helper to check if a value is hidden
const isHiddenValue = (val: any): val is string =>
  val === "***" || val === null || val === undefined;

export function EquityPositionsTable({
  positions,
  isOwner,
  isPublic,
  privacySettings,
  sortKey,
  sortDir,
  onSort,
  sparklineDataMap,
  onToggleVisibility,
}: EquityPositionsTableProps) {
  const { t } = useTranslation();

  if (positions.length === 0) return null;

  return (
    <>
      <EquityPositionsCards
        positions={positions}
        isOwner={isOwner}
        isPublic={isPublic}
        onToggleVisibility={onToggleVisibility}
      />
      <div className="hidden overflow-x-auto sm:block">
        <Table className="[&_td]:py-2 [&_th]:h-9">
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
                className="w-[25%] pl-4"
              />
              <TableHead className="w-[5rem] hidden sm:table-cell">
                <span className="text-xs text-muted-foreground">{t("portfolio.table.chart")}</span>
              </TableHead>
              <SortableHeader
                label={t("portfolio.table.price")}
                sortKey="price"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="amount"
              />
              <SortableHeader
                label={t("portfolio.table.cost")}
                sortKey="cost"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="amount"
              />
              <SortableHeader
                label={t("portfolio.table.shares")}
                sortKey="units"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="center"
                type="numeric"
              />
              <SortableHeader
                label={t("portfolio.table.value")}
                sortKey="value"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="amount"
              />
              <SortableHeader
                label={t("portfolio.table.totalPnl")}
                sortKey="pnl"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="amount"
              />
              <SortableHeader
                label={t("portfolio.table.pnlPerShare")}
                sortKey="pnl_per_share"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="amount"
              />
              <SortableHeader
                label={t("portfolio.table.weight")}
                sortKey="weight"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                type="numeric"
                className={isOwner && isPublic ? "" : "pr-4"}
              />
              {isOwner && isPublic && (
                <TableHead className="w-[3.125rem] pr-4">
                  <span className="text-xs text-muted-foreground">
                    {t("portfolio.table.public")}
                  </span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((pos: PortfolioPosition) => {
              const isHiddenPosition = pos.is_hidden || pos.units == null;
              const pnl = equityOpenPnl(pos);
              const profit = (pnl ?? 0) >= 0;
              const isShort = !isHiddenValue(pos.units) && (pos.units as number) < 0;
              // P&L per share = current price - average purchase price
              const safePrice = isHiddenValue(pos.price) ? 0 : (pos.price as number);
              const safeAvgPrice = isHiddenValue(pos.average_purchase_price)
                ? 0
                : (pos.average_purchase_price as number);
              const pnlPerShare = isShort ? safeAvgPrice - safePrice : safePrice - safeAvgPrice;
              const pnlPerShareProfit = pnlPerShare >= 0;
              // Privacy: per-share PnL visibility (owner always sees, public checks setting)
              const showPnlPerShare =
                isOwner || privacySettings?.show_position_pnl_per_share !== false;
              const isSecretStock = isHiddenPosition && !isOwner;

              return (
                <TableRow
                  key={pos.id}
                  className={`${
                    isSecretStock ? "opacity-70" : "hover:bg-foreground/[0.06]"
                  } transition-colors`}
                >
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      {isSecretStock ? (
                        <div className="w-8 h-8 rounded-2xl bg-muted/80 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <Link
                          href={marketStockHref(pos.symbol)}
                          aria-label={pos.symbol}
                          className="rounded-2xl underline-offset-4 hover:opacity-90 focus-visible:outline-none "
                        >
                          <CompanyLogo
                            symbol={pos.symbol}
                            name={pos.security_name || pos.symbol}
                            size="sm"
                            border="light"
                          />
                        </Link>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold flex items-center gap-1.5">
                          {isSecretStock ? (
                            <span className="text-muted-foreground">****</span>
                          ) : (
                            <Link
                              href={marketStockHref(pos.symbol)}
                              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none "
                            >
                              {pos.symbol}
                            </Link>
                          )}
                        </div>
                        <div
                          className="text-xs text-muted-foreground truncate max-w-[9.375rem]"
                          title={isSecretStock ? "" : pos.security_name || ""}
                        >
                          {isSecretStock ? t("portfolio.table.lockedStock") : pos.security_name}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex justify-center">
                      {isSecretStock ? (
                        <div className="w-20 h-5 bg-muted/50 rounded" />
                      ) : (
                        <MiniSparkline
                          data={sparklineDataMap.get(pos.symbol) || []}
                          width={80}
                          height={20}
                          strokeWidth={1.2}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {isSecretStock || isHiddenValue(pos.price) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      formatCurrency(pos.price as number)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {isSecretStock || isHiddenValue(pos.average_purchase_price) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      formatCurrency(pos.average_purchase_price as number)
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    <div className="inline-flex items-center justify-center gap-1">
                      {isShort && (
                        <Badge variant="destructive" size="xxs" className="!text-[0.625rem]">
                          {t("portfolio.table.short")}
                        </Badge>
                      )}
                      {isSecretStock || isHiddenValue(pos.units) ? (
                        <span className="text-muted-foreground">***</span>
                      ) : (
                        <span className="tabular-nums">{Math.abs(pos.units)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {isSecretStock || isHiddenValue(pos.market_value) ? (
                      <span className="text-muted-foreground">***</span>
                    ) : (
                      formatCurrency(pos.market_value as number)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSecretStock || (pos.open_pnl as unknown) === "***" ? (
                      <span className="text-muted-foreground">***</span>
                    ) : pnl === null ? (
                      <span className="text-muted-foreground">—</span>
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
                    {isSecretStock ||
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
                    {isSecretStock || isHiddenValue(pos.weight_percent) ? (
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

/** Phone layout: one row per position instead of a 9-column table that scrolls sideways. */
function EquityPositionsCards({
  positions,
  isOwner,
  isPublic,
  onToggleVisibility,
}: Pick<EquityPositionsTableProps, "positions" | "isOwner" | "isPublic" | "onToggleVisibility">) {
  const { t } = useTranslation();

  return (
    <ul className="divide-y divide-border sm:hidden">
      {positions.map((pos: PortfolioPosition) => {
        const isSecretStock = (pos.is_hidden || pos.units == null) && !isOwner;
        const pnl = equityOpenPnl(pos);
        const profit = (pnl ?? 0) >= 0;
        const isShort = !isHiddenValue(pos.units) && (pos.units as number) < 0;
        const hiddenPnl = isSecretStock || (pos.open_pnl as unknown) === "***";
        const money = (val: unknown) =>
          isSecretStock || isHiddenValue(val) ? "***" : formatCurrency(val as number);

        return (
          <li
            key={pos.id}
            className={`flex items-start gap-3 px-4 py-3 ${isSecretStock ? "opacity-70" : ""}`}
          >
            {isSecretStock ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-muted/80">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <Link href={marketStockHref(pos.symbol)} aria-label={pos.symbol} className="shrink-0">
                <CompanyLogo
                  symbol={pos.symbol}
                  name={pos.security_name || pos.symbol}
                  size="sm"
                  border="light"
                />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1.5 font-semibold">
                  {isSecretStock ? (
                    <span className="text-muted-foreground">****</span>
                  ) : (
                    <Link href={marketStockHref(pos.symbol)} className="truncate">
                      {pos.symbol}
                    </Link>
                  )}
                  {isShort && (
                    <Badge variant="destructive" size="xxs" className="!text-[0.625rem]">
                      {t("portfolio.table.short")}
                    </Badge>
                  )}
                </div>
                <span className="shrink-0 font-medium tabular-nums">{money(pos.market_value)}</span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground">
                  {isSecretStock ? t("portfolio.table.lockedStock") : pos.security_name}
                </span>
                {hiddenPnl ? (
                  <span className="shrink-0 text-muted-foreground">***</span>
                ) : pnl === null ? (
                  <span className="shrink-0 text-muted-foreground">—</span>
                ) : (
                  <span
                    className={`inline-flex shrink-0 items-center gap-0.5 font-medium tabular-nums ${
                      profit ? "text-positive" : "text-negative"
                    }`}
                  >
                    {profit ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {profit ? "+" : "−"}
                    {formatCurrency(Math.abs(pnl))}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                <span>
                  {t("portfolio.table.shares")}{" "}
                  {isSecretStock || isHiddenValue(pos.units) ? "***" : Math.abs(pos.units)}
                </span>
                <span>
                  {t("portfolio.table.price")} {money(pos.price)}
                </span>
                <span>
                  {t("portfolio.table.cost")} {money(pos.average_purchase_price)}
                </span>
                {!isSecretStock && !isHiddenValue(pos.weight_percent) && (
                  <span>
                    {t("portfolio.table.weight")} {Math.abs(pos.weight_percent || 0).toFixed(1)}%
                  </span>
                )}
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
