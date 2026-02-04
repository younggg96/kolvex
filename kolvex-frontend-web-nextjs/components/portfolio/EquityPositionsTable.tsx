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
import { WeightIndicator } from "@/components/ui/weight-indicator";
import MiniSparkline from "@/components/stock/MiniSparkline";
import { formatCurrency } from "@/lib/snaptradeApi";
import type { EquityPositionsTableProps, SnapTradePosition } from "./types";

// Helper to check if a value is hidden
const isHiddenValue = (val: any): val is string =>
  val === "***" || val === null || val === undefined;

export function EquityPositionsTable({
  positions,
  isOwner,
  isPublic,
  sortKey,
  sortDir,
  onSort,
  sparklineDataMap,
  onToggleVisibility,
}: EquityPositionsTableProps) {
  const router = useRouter();

  if (positions.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader
              label="Symbol"
              sortKey="symbol"
              currentSortKey={sortKey}
              sortDirection={sortDir}
              onSort={onSort}
              align="left"
              type="alpha"
              className="w-[25%] pl-4"
            />
            <TableHead className="w-[80px] hidden sm:table-cell">
              <span className="text-xs text-muted-foreground">Chart</span>
            </TableHead>
            <SortableHeader
              label="Price"
              sortKey="price"
              currentSortKey={sortKey}
              sortDirection={sortDir}
              onSort={onSort}
              align="right"
              type="amount"
            />
            <SortableHeader
              label="Cost"
              sortKey="cost"
              currentSortKey={sortKey}
              sortDirection={sortDir}
              onSort={onSort}
              align="right"
              type="amount"
            />
            <SortableHeader
              label="Shares"
              sortKey="units"
              currentSortKey={sortKey}
              sortDirection={sortDir}
              onSort={onSort}
              align="center"
              type="numeric"
            />
            <SortableHeader
              label="Value"
              sortKey="value"
              currentSortKey={sortKey}
              sortDirection={sortDir}
              onSort={onSort}
              align="right"
              type="amount"
            />
            <SortableHeader
              label="P&L"
              sortKey="pnl"
              currentSortKey={sortKey}
              sortDirection={sortDir}
              onSort={onSort}
              align="right"
              type="amount"
            />
            <SortableHeader
              label="Weight"
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
                <span className="text-xs text-muted-foreground">Public</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((pos: SnapTradePosition) => {
            const isHiddenPosition = pos.is_hidden || pos.units == null;
            const pnl = pos.open_pnl ?? 0;
            const profit = pnl >= 0;
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
                          pos.symbol
                        )}
                      </div>
                      <div
                        className="text-xs text-muted-foreground truncate max-w-[150px]"
                        title={isSecretStock ? "" : pos.security_name || ""}
                      >
                        {isSecretStock ? "Locked Stock" : pos.security_name}
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
                  {isSecretStock || isHiddenValue(pos.units) ? (
                    <span className="text-muted-foreground">***</span>
                  ) : (
                    pos.units
                  )}
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
                          ? "Hidden from public - Click to show"
                          : "Visible to public - Click to hide"
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

