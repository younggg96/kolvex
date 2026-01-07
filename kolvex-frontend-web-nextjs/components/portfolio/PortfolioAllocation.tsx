"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { SectionCard } from "../layout";
import {
  DonutChart,
  SectorLegend,
  SectorTable,
  useSectorData,
} from "./allocation";
import type { PortfolioAllocationProps, SortKey } from "./allocation";

/**
 * PortfolioAllocation Component
 *
 * Displays portfolio allocation by sector with:
 * - Donut chart visualization
 * - Interactive sector legend
 * - Expandable sector table with aggregated positions
 *
 * Features:
 * - Aggregates duplicate stocks (same symbol from different positions)
 * - Shows combined stock + options positions
 * - Interactive hover/click to highlight sectors
 * - Sortable table columns
 */
export function PortfolioAllocation({
  holdings,
  className = "",
  isOwner = true,
}: PortfolioAllocationProps) {
  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>("allocation");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Hover state
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  // Expansion state
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(
    new Set()
  );

  // Get processed sector data with aggregation (fixes duplicate stocks)
  const { sectorData, totalValue } = useSectorData({
    holdings,
    sortKey,
    sortDir,
  });

  // Toggle sector expansion
  const toggleSector = (sectorName: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sectorName)) {
        next.delete(sectorName);
      } else {
        next.add(sectorName);
      }
      return next;
    });
  };

  // Handle sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Don't render if no data
  if (holdings.length === 0 || sectorData.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title="Portfolio Allocation by Sector"
      titleSize="md"
      className={className}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
        {/* Donut Chart with Bar Legend - Only show for owner */}
        {isOwner && (
          <div className="flex flex-col items-center gap-4 col-span-1">
            <DonutChart
              sectorData={sectorData}
              totalValue={totalValue}
              hoveredSector={hoveredSector}
              setHoveredSector={setHoveredSector}
              toggleSector={toggleSector}
            />
            <SectorLegend
              sectorData={sectorData}
              totalValue={totalValue}
              hoveredSector={hoveredSector}
              setHoveredSector={setHoveredSector}
              expandedSectors={expandedSectors}
              toggleSector={toggleSector}
            />
          </div>
        )}

        {/* Sector Table */}
        <div
          className={cn(
            "overflow-x-auto",
            isOwner ? "col-span-2" : "col-span-3 pb-4"
          )}
        >
          <SectorTable
            sectorData={sectorData}
            totalValue={totalValue}
            isOwner={isOwner}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            hoveredSector={hoveredSector}
            setHoveredSector={setHoveredSector}
            expandedSectors={expandedSectors}
            toggleSector={toggleSector}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default PortfolioAllocation;
