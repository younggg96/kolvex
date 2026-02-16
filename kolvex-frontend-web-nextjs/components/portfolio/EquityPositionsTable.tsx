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
import MiniSparkline from "@/components/stock/MiniSparkline";
import { formatCurrency } from "@/lib/snaptradeApi";
import { useTranslation } from "@/lib/i18n";
import type { EquityPositionsTableProps, SnapTradePosition } from "./types";

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
  const router = useRouter();
  const { t } = useTranslation();

  if (positions.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <Table>
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
            <TableHead className="w-[80px] hidden sm:table-cell">
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
              <TableHead className="w-[50px] pr-4">
                <span className="text-xs text-muted-foreground">{t("portfolio.table.public")}</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((pos: SnapTradePosition) => {
            const isHiddenPosition = pos.is_hidden || pos.units == null;
            const pnl = pos.open_pnl ?? 0;
            const profit = pnl >= 0;
            const isShort = !isHiddenValue(pos.units) && (pos.units as number) < 0;
            // P&L per share = current price - average purchase price
            const safePrice = isHiddenValue(pos.price) ? 0 : (pos.price as number);
            const safeAvgPrice = isHiddenValue(pos.average_purchase_price) ? 0 : (pos.average_purchase_price as number);
            const pnlPerShare = isShort ? safeAvgPrice - safePrice : safePrice - safeAvgPrice;
            const pnlPerShareProfit = pnlPerShare >= 0;
            // Privacy: per-share PnL visibility (owner always sees, public checks setting)
            const showPnlPerShare = isOwner || privacySettings?.show_position_pnl_per_share !== false;
            const isSecretStock = isHiddenPosition && !isOwner;

            return (
              <TableRow
                key={pos.id}
                className={`${isSecretStock
                  ? "opacity-70"
                  : "hover:bg-muted/50"
                  } transition-colors`}
              >
                <TableCell className="pl-4 py-3 cursor-pointer" onClick={() =>
                  !isSecretStock && router.push(`/dashboard/stock/${pos.symbol}`)
                }>
                  <div className="flex items-center gap-2.5">
                    {isSecretStock ? (
                      <div className="w-8 h-8 rounded-lg bg-muted/80 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <CompanyLogo
                        symbol={pos.symbol}
                        name={pos.security_name || pos.symbol}
                        size="sm"
                        shape="rounded"
                        border="light"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-1.5">
                        {isSecretStock ? (
                          <span className="text-muted-foreground">****</span>
                        ) : (
                          <span>
                            {pos.symbol}
                          </span>
                        )}
                      </div>
                      <div
                        className="text-xs text-muted-foreground truncate max-w-[150px]"
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
                      <Badge variant="destructive" size="xxs" className="!text-[10px]">
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
                  {isSecretStock || isHiddenValue(pos.open_pnl) ? (
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
                  {isSecretStock || !showPnlPerShare || isHiddenValue(pos.price) || isHiddenValue(pos.average_purchase_price) ? (
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
                  {isSecretStock || isHiddenValue(pos.weight_percent) ? (
                    <span className="text-muted-foreground">***</span>
                  ) : (
                    <WeightIndicator percent={Math.abs(pos.weight_percent || 0)} />
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
  );
}

