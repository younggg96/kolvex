"use client";

import React, { useMemo, useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import type { SnapTradePosition } from "@/lib/supabase/database.types";
import type { StockOverview } from "@/lib/stockApi";
import { SectionCard } from "../layout";
import CompanyLogo from "@/components/ui/company-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ================== TYPES ==================

interface PortfolioAllocationProps {
  holdings: SnapTradePosition[];
  className?: string;
  isOwner?: boolean;
}

interface PositionInfo {
  symbol: string;
  displaySymbol: string; // For options: underlying symbol; for stocks: same as symbol
  securityName?: string;
  value: number;
  invested: number;
  gain: number;
  gainPercent: number;
  isOption: boolean;
  optionType?: "call" | "put";
  positionDirection?: "long" | "short";
}

interface SectorData {
  name: string;
  value: number;
  invested: number;
  gain: number;
  gainPercent: number;
  count: number;
  color: string;
  positions: PositionInfo[];
}

// ================== COLOR PALETTE ==================

const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "#00C805", // Primary Green
  Technology: "#00C805",
  Financials: "#3b82f6", // Blue
  Financial: "#3b82f6",
  "Health Care": "#f43f5e", // Rose
  Healthcare: "#f43f5e",
  "Consumer Discretionary": "#fbbf24", // Amber
  "Consumer Staples": "#a3e635", // Lime
  "Communication Services": "#0ea5e9", // Sky Blue
  Industrials: "#94a3b8", // Slate
  Energy: "#ef4444", // Red
  Utilities: "#06b6d4", // Cyan
  "Real Estate": "#f97316", // Orange
  Materials: "#14b8a6", // Teal
  Funds: "#6366f1", // Indigo
  ETF: "#6366f1",
  Other: "#64748b", // Slate
};

const DEFAULT_COLORS = [
  "#00C805", // Primary
  "#3b82f6", // Blue
  "#0ea5e9", // Sky Blue
  "#f43f5e", // Rose
  "#fbbf24", // Amber
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#a3e635", // Lime
  "#64748b", // Slate
];

function getSectorColor(sector: string, index: number): string {
  return SECTOR_COLORS[sector] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

// ================== OPTION PARSING ==================

/**
 * Parse option symbol to extract call/put type
 * Example: "SOFI 270115C00022000" -> { type: "call" }
 * The format is: SYMBOL YYMMDD[C/P]PRICE
 */
function parseOptionSymbol(symbol: string): { type: "call" | "put" } | null {
  // Match pattern: any chars followed by space, then 6 digits, then C or P
  const match = symbol.match(/\s\d{6}([CP])/i);
  if (match) {
    return { type: match[1].toUpperCase() === "C" ? "call" : "put" };
  }
  return null;
}

// ================== UTILITY FUNCTIONS ==================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "" : ""}${value.toFixed(2)}%`;
}

// ================== CUSTOM TOOLTIP ==================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: SectorData;
  }>;
}

function DonutTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const totalValue = data.value;
  const isPositive = data.gain >= 0;

  return (
    <div className="bg-card-dark border border-border-dark rounded-lg p-3 shadow-xl min-w-[180px]">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: data.color }}
        />
        <span className="font-semibold text-white">{data.name}</span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Value:</span>
          <span className="font-medium text-white">
            {formatCurrency(totalValue)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Items:</span>
          <span className="font-medium text-white">{data.count}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">P&L:</span>
          <span
            className={`font-medium ${
              isPositive ? "text-[#00C805]" : "text-[#ff4444]"
            }`}
          >
            {isPositive ? "+" : ""}
            {formatCurrency(data.gain)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ================== CUSTOM LABEL ==================

interface CustomLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}

function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: CustomLabelProps) {
  // Only show label if segment is large enough
  if (percent < 0.05) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
      className="pointer-events-none select-none"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ================== MAIN COMPONENT ==================

export function PortfolioAllocation({
  holdings,
  className = "",
  isOwner = true,
}: PortfolioAllocationProps) {
  const [sectorMap, setSectorMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<"value" | "gain" | "allocation">(
    "allocation"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(
    new Set()
  );

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

  // Fetch sector information for all holdings
  useEffect(() => {
    const fetchSectors = async () => {
      setLoading(true);
      const newMap = new Map<string, string>();

      // Get unique symbols (excluding options)
      const symbols = new Set<string>();
      holdings.forEach((pos) => {
        if (pos.is_hidden) return;
        if (pos.position_type === "option") {
          // Use underlying symbol for options
          const sym = pos.underlying_symbol || pos.symbol;
          if (sym) symbols.add(sym);
        } else {
          if (pos.symbol) symbols.add(pos.symbol);
        }
      });

      // Fetch overview for each symbol (in parallel, batched)
      const symbolArray = Array.from(symbols);
      const batchSize = 5;

      for (let i = 0; i < symbolArray.length; i += batchSize) {
        const batch = symbolArray.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (symbol) => {
            try {
              const res = await fetch(
                `/api/stocks?action=overview&symbol=${symbol}`
              );
              if (res.ok) {
                const data: StockOverview = await res.json();
                if (data.company?.sector) {
                  newMap.set(symbol, data.company.sector);
                }
              }
            } catch (error) {
              console.error(`Failed to fetch sector for ${symbol}:`, error);
            }
          })
        );
      }

      setSectorMap(newMap);
      setLoading(false);
    };

    if (holdings.length > 0) {
      fetchSectors();
    } else {
      setLoading(false);
    }
  }, [holdings]);

  // Process holdings into sector allocation data
  const sectorData = useMemo(() => {
    const sectors: Record<string, SectorData> = {};

    holdings.forEach((pos, index) => {
      if (pos.is_hidden) return;

      const marketValue =
        pos.market_value ??
        (pos.price ?? 0) *
          pos.units *
          (pos.position_type === "option" ? 100 : 1);
      const costBasis =
        (pos.average_purchase_price ?? 0) *
        pos.units *
        (pos.position_type === "option" ? 1 : 1);
      const gain = pos.open_pnl ?? marketValue - costBasis;
      const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

      // Determine sector - options use underlying symbol
      const symbol =
        pos.position_type === "option"
          ? pos.underlying_symbol || pos.symbol
          : pos.symbol;
      let sector = sectorMap.get(symbol) || "Other";

      // Check if it's an ETF/Fund (simple heuristic)
      if (
        pos.security_name?.toLowerCase().includes("etf") ||
        pos.security_name?.toLowerCase().includes("fund") ||
        pos.security_name?.toLowerCase().includes("index")
      ) {
        sector = "Funds";
      }

      if (!sectors[sector]) {
        sectors[sector] = {
          name: sector,
          value: 0,
          invested: 0,
          gain: 0,
          gainPercent: 0,
          count: 0,
          color: getSectorColor(sector, Object.keys(sectors).length),
          positions: [],
        };
      }

      sectors[sector].value += marketValue;
      sectors[sector].invested += costBasis;
      sectors[sector].gain += gain;
      sectors[sector].count += 1;

      // Parse option info if applicable
      const isOption = pos.position_type === "option";
      const optionInfo = isOption ? parseOptionSymbol(pos.symbol) : null;
      const displaySymbol = isOption
        ? pos.underlying_symbol || pos.symbol.split(" ")[0]
        : pos.symbol;

      sectors[sector].positions.push({
        symbol: pos.symbol,
        displaySymbol,
        securityName: pos.security_name,
        value: marketValue,
        invested: costBasis,
        gain,
        gainPercent,
        isOption,
        optionType: optionInfo?.type,
        positionDirection: pos.units >= 0 ? "long" : "short",
      });
    });

    // Calculate gain percent for each sector
    Object.values(sectors).forEach((sector) => {
      sector.gainPercent =
        sector.invested > 0 ? (sector.gain / sector.invested) * 100 : 0;
    });

    // Sort by the selected key
    const sortedSectors = Object.values(sectors).sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortKey) {
        case "value":
          aVal = a.value;
          bVal = b.value;
          break;
        case "gain":
          aVal = a.gainPercent;
          bVal = b.gainPercent;
          break;
        case "allocation":
        default:
          aVal = a.value;
          bVal = b.value;
          break;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return sortedSectors;
  }, [holdings, sectorMap, sortKey, sortDir]);

  // Calculate total value
  const totalValue = useMemo(
    () => sectorData.reduce((acc, s) => acc + s.value, 0),
    [sectorData]
  );

  // Handle sort
  const handleSort = (key: "value" | "gain" | "allocation") => {
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
      className={`${className}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
        {/* Donut Chart with Bar Legend */}
        {isOwner && (
          <div className="flex flex-col items-center gap-4 col-span-1">
            {/* Donut Chart */}
            <div className="relative w-full aspect-square">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel}
                    onClick={(_, index) => toggleSector(sectorData[index].name)}
                    onMouseEnter={(_, index) =>
                      setHoveredSector(sectorData[index].name)
                    }
                    onMouseLeave={() => setHoveredSector(null)}
                  >
                    {sectorData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="transparent"
                        strokeWidth={0}
                        style={{
                          opacity:
                            hoveredSector === null ||
                            hoveredSector === entry.name
                              ? 1
                              : 0.4,
                          transition: "opacity 0.2s ease",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<DonutTooltip />}
                    wrapperStyle={{ zIndex: 100 }}
                    position={{ x: 10, y: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <>
                  <span className="text-xs text-muted-foreground">
                    Total Value
                  </span>
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(totalValue)}
                  </span>
                </>
              </div>
            </div>
            {/* Bar Legend - Only show for owner */}
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
          </div>
        )}
        {/* Sector Table */}
        <div
          className={cn(
            "overflow-x-auto",
            isOwner ? "col-span-2" : "col-span-3 pb-4"
          )}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light dark:border-border-dark">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                  Name
                </th>
                {isOwner && (
                  <>
                    <th
                      className="text-right py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("value")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Value/Invested
                        {sortKey === "value" &&
                          (sortDir === "desc" ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronUp className="w-3 h-3" />
                          ))}
                      </span>
                    </th>
                    <th
                      className="text-right py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("gain")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Gain
                        {sortKey === "gain" &&
                          (sortDir === "desc" ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronUp className="w-3 h-3" />
                          ))}
                      </span>
                    </th>
                    <th
                      className="text-right py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("allocation")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Allocation
                        {sortKey === "allocation" &&
                          (sortDir === "desc" ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronUp className="w-3 h-3" />
                          ))}
                      </span>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sectorData.map((sector) => {
                const isPositive = sector.gain >= 0;
                const allocation =
                  totalValue > 0 ? (sector.value / totalValue) * 100 : 0;
                const isHovered = hoveredSector === sector.name;
                const isExpanded = expandedSectors.has(sector.name);

                return (
                  <React.Fragment key={sector.name}>
                    {/* Sector Row */}
                    <tr
                      className={`border-b border-border-light dark:border-border-dark transition-colors cursor-pointer ${
                        isHovered || isExpanded
                          ? "bg-primary/10"
                          : "hover:bg-muted/30"
                      }`}
                      onClick={() => toggleSector(sector.name)}
                      onMouseEnter={() => setHoveredSector(sector.name)}
                      onMouseLeave={() => setHoveredSector(null)}
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <ChevronRight
                            className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
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
                      </td>
                      {isOwner && (
                        <>
                          <td className="py-3 px-2 text-right">
                            <div className="font-semibold text-foreground">
                              {formatCurrency(sector.value)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(sector.invested)}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
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
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="font-semibold text-foreground">
                              {allocation.toFixed(2)}%
                            </span>
                          </td>
                        </>
                      )}
                    </tr>

                    {/* Expanded Position Rows */}
                    {isExpanded &&
                      sector.positions.map((pos, posIndex) => {
                        const posIsPositive = pos.gain >= 0;
                        const posAllocation =
                          totalValue > 0 ? (pos.value / totalValue) * 100 : 0;

                        return (
                          <tr
                            key={`${sector.name}-${pos.symbol}-${posIndex}`}
                            className="border-b border-border-light/50 dark:border-border-dark/50 bg-muted/20 dark:bg-muted/10"
                          >
                            <td className="py-2 px-2 pl-12">
                              <div className="flex items-center gap-2">
                                <CompanyLogo
                                  symbol={pos.displaySymbol}
                                  size="xs"
                                  shape="rounded"
                                  border="light"
                                />
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground text-sm">
                                      {pos.displaySymbol}
                                    </span>
                                    {pos.isOption && (
                                      <>
                                        <Badge
                                          size="xs"
                                          className={cn(
                                            "border-0",
                                            pos.optionType === "call"
                                              ? "bg-primary/20 text-primary"
                                              : "bg-destructive/20 text-destructive"
                                          )}
                                        >
                                          {pos.optionType === "call"
                                            ? "CALL"
                                            : "PUT"}
                                        </Badge>
                                        <Badge
                                          size="xs"
                                          className={cn(
                                            "border-0",
                                            pos.positionDirection === "long"
                                              ? "bg-blue-500/10 text-blue-500"
                                              : "bg-orange-500/10 text-orange-500"
                                          )}
                                        >
                                          {pos.positionDirection === "long"
                                            ? "LONG"
                                            : "SHORT"}
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                  {pos.securityName && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {pos.securityName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            {isOwner && (
                              <>
                                <td className="py-2 px-2 text-right">
                                  <div className="font-medium text-foreground text-sm">
                                    {formatCurrency(pos.value)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatCurrency(pos.invested)}
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <div
                                    className="font-medium text-sm"
                                    style={{
                                      color: posIsPositive
                                        ? "#00C805"
                                        : "#ff4444",
                                    }}
                                  >
                                    {posIsPositive ? "" : "-"}
                                    {formatCurrency(Math.abs(pos.gain))}
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
                                        color: posIsPositive
                                          ? "#00C805"
                                          : "#ff4444",
                                      }}
                                    >
                                      {Math.abs(pos.gainPercent).toFixed(2)}%
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <span className="text-sm text-muted-foreground">
                                    {posAllocation.toFixed(2)}%
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}

export default PortfolioAllocation;
