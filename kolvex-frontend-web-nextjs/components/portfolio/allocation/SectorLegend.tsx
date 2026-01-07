"use client";

import React from "react";
import type { SectorLegendProps } from "./types";

export function SectorLegend({
  sectorData,
  totalValue,
  hoveredSector,
  setHoveredSector,
  expandedSectors,
  toggleSector,
}: SectorLegendProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full px-4 pb-4">
      {sectorData.slice(0, 8).map((sector) => {
        const allocation =
          totalValue > 0 ? (sector.value / totalValue) * 100 : 0;
        const isHovered = hoveredSector === sector.name;
        const isExpanded = expandedSectors.has(sector.name);

        return (
          <div
            key={sector.name}
            className={`cursor-pointer transition-all ${
              isHovered || isExpanded ? "scale-105" : ""
            }`}
            onClick={() => toggleSector(sector.name)}
            onMouseEnter={() => setHoveredSector(sector.name)}
            onMouseLeave={() => setHoveredSector(null)}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span
                className={`text-[10px] truncate max-w-[60px] ${
                  isHovered || isExpanded
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {sector.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {allocation.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 w-full bg-muted/30 rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all"
                style={{
                  width: `${allocation}%`,
                  backgroundColor: sector.color,
                  opacity: isHovered || isExpanded ? 1 : 0.8,
                }}
              />
            </div>
          </div>
        );
      })}
      {sectorData.length > 8 && (
        <span className="text-[10px] text-muted-foreground text-center">
          +{sectorData.length - 8} more
        </span>
      )}
    </div>
  );
}

export default SectorLegend;

