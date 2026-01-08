"use client";

import React from "react";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import { cn } from "@/lib/utils";
import type { SectorTableProps, SortKey } from "./types";
import { formatCurrency } from "./utils";

// ================== SECTOR TABLE COMPONENT ==================

export function SectorTable({
  sectorData,
  totalValue,
  isOwner,
  sortKey,
  sortDir,
  onSort,
  hoveredSector,
  setHoveredSector,
  expandedSectors,
  toggleSector,
}: SectorTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border-light dark:border-border-dark hover:bg-transparent">
          <TableHead className="text-left py-2 px-2">Name</TableHead>
          {isOwner && (
            <>
              <SortableHeader<SortKey>
                label="Value/Invested"
                sortKey="value"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                className="py-2 px-2"
              />
              <SortableHeader<SortKey>
                label="Gain"
                sortKey="gain"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                className="py-2 px-2"
              />
              <SortableHeader<SortKey>
                label="Allocation"
                sortKey="allocation"
                currentSortKey={sortKey}
                sortDirection={sortDir}
                onSort={onSort}
                align="right"
                className="py-2 px-2"
              />
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sectorData.map((sector) => {
          const isPositive = sector.gain >= 0;
          const allocation =
            totalValue > 0 ? (sector.value / totalValue) * 100 : 0;
          const isHovered = hoveredSector === sector.name;
          const isExpanded = expandedSectors.has(sector.name);

          return (
            <React.Fragment key={sector.name}>
              {/* Sector Row */}
              <TableRow
                className={cn(
                  "cursor-pointer",
                  isHovered || isExpanded
                    ? "bg-primary/10 hover:bg-primary/10"
                    : ""
                )}
                onClick={() => toggleSector(sector.name)}
                onMouseEnter={() => setHoveredSector(sector.name)}
                onMouseLeave={() => setHoveredSector(null)}
              >
                <TableCell className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: sector.color + "30" }}
                    >
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: sector.color }}
                      />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {sector.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sector.count} item
                        {sector.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                </TableCell>
                {isOwner && (
                  <>
                    <TableCell className="py-3 px-2 text-right">
                      <div className="font-semibold text-foreground">
                        {formatCurrency(sector.value)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(sector.invested)}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-2 text-right">
                      <div
                        className="font-medium"
                        style={{
                          color: isPositive ? "#00C805" : "#ff4444",
                        }}
                      >
                        {isPositive ? "" : "-"}
                        {formatCurrency(Math.abs(sector.gain))}
                      </div>
                      <div className="flex items-center justify-end gap-0.5">
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3 text-[#00C805]" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-[#ff4444]" />
                        )}
                        <span
                          className="text-xs"
                          style={{
                            color: isPositive ? "#00C805" : "#ff4444",
                          }}
                        >
                          {Math.abs(sector.gainPercent).toFixed(2)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-2 text-right">
                      <span className="font-semibold text-foreground">
                        {allocation.toFixed(2)}%
                      </span>
                    </TableCell>
                  </>
                )}
              </TableRow>

              {/* Expanded Position Rows - showing aggregated positions */}
              {isExpanded &&
                sector.positions.map((aggPos, posIndex) => {
                  const posIsPositive = aggPos.gain >= 0;
                  const posAllocation =
                    totalValue > 0 ? (aggPos.value / totalValue) * 100 : 0;
                  const hasMultiple = aggPos.subPositions.length > 1;

                  return (
                    <TableRow
                      key={`${sector.name}-${aggPos.displaySymbol}-${posIndex}`}
                      className="border-b border-border-light/50 dark:border-border-dark/50 bg-muted/20 dark:bg-muted/10 hover:bg-muted/30"
                    >
                      <TableCell className="py-2 px-2 pl-12">
                        <div className="flex items-center gap-2">
                          <CompanyLogo
                            symbol={aggPos.displaySymbol}
                            size="xs"
                            shape="rounded"
                            border="light"
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground text-sm">
                                {aggPos.displaySymbol}
                              </span>
                              {aggPos.hasOptions && aggPos.hasEquity && (
                                <Badge
                                  size="xs"
                                  variant="secondary"
                                  className="!text-[9px] sm:!text-[11px]"
                                >
                                  Stock + Option
                                </Badge>
                              )}
                              {aggPos.hasOptions && !aggPos.hasEquity && (
                                <Badge
                                  size="xs"
                                  variant="outline"
                                  className="!text-[9px] sm:!text-[11px]"
                                >
                                  Option
                                </Badge>
                              )}
                              {hasMultiple && (
                                <span className="text-xs text-muted-foreground">
                                  ({aggPos.subPositions.length} positions)
                                </span>
                              )}
                            </div>
                            {aggPos.securityName && (
                              <span className="text-xs text-muted-foreground truncate w-[80px] sm:w-full">
                                {aggPos.securityName}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {isOwner && (
                        <>
                          <TableCell className="py-2 px-2 text-right">
                            <div className="font-medium text-foreground text-sm">
                              {formatCurrency(aggPos.value)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(aggPos.invested)}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-2 text-right">
                            <div
                              className="font-medium text-sm"
                              style={{
                                color: posIsPositive ? "#00C805" : "#ff4444",
                              }}
                            >
                              {posIsPositive ? "" : "-"}
                              {formatCurrency(Math.abs(aggPos.gain))}
                            </div>
                            <div className="flex items-center justify-end gap-0.5">
                              {posIsPositive ? (
                                <TrendingUp className="w-3 h-3 text-[#00C805]" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-[#ff4444]" />
                              )}
                              <span
                                className="text-xs"
                                style={{
                                  color: posIsPositive ? "#00C805" : "#ff4444",
                                }}
                              >
                                {Math.abs(aggPos.gainPercent).toFixed(2)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-2 text-right">
                            <span className="text-sm text-muted-foreground">
                              {posAllocation.toFixed(2)}%
                            </span>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default SectorTable;
