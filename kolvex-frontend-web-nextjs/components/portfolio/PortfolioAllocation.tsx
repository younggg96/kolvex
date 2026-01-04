"use client";

import React, { useMemo, useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SnapTradePosition } from "@/lib/supabase/database.types";
import type { StockOverview } from "@/lib/stockApi";

// ================== TYPES ==================

interface PortfolioAllocationProps {
  holdings: SnapTradePosition[];
  className?: string;
}

interface SectorData {
  name: string;
  value: number;
  invested: number;
  gain: number;
  gainPercent: number;
  count: number;
  color: string;
  positions: {
    symbol: string;
    value: number;
    invested: number;
    gain: number;
    gainPercent: number;
  }[];
}

// ================== COLOR PALETTE ==================

const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "#3b82f6", // blue
  Technology: "#3b82f6",
  Financials: "#06b6d4", // cyan
  Financial: "#06b6d4",
  "Health Care": "#10b981", // emerald
  Healthcare: "#10b981",
  "Consumer Discretionary": "#f59e0b", // amber
  "Consumer Staples": "#84cc16", // lime
  "Communication Services": "#8b5cf6", // violet
  Industrials: "#6366f1", // indigo
  Energy: "#ef4444", // red
  Utilities: "#14b8a6", // teal
  "Real Estate": "#f97316", // orange
  Materials: "#ec4899", // pink
  Funds: "#a855f7", // purple
  ETF: "#a855f7",
  Options: "#22d3ee", // cyan-400
  Other: "#6b7280", // gray
};

const DEFAULT_COLORS = [
  "#3b82f6",
  "#a855f7",
  "#06b6d4",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
];

function getSectorColor(sector: string, index: number): string {
  return SECTOR_COLORS[sector] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
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
              isPositive ? "text-green-500" : "text-red-500"
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
}: PortfolioAllocationProps) {
  const [sectorMap, setSectorMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<"value" | "gain" | "allocation">(
    "allocation"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

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

      // Determine sector
      let sector: string;
      if (pos.position_type === "option") {
        sector = "Options";
      } else {
        const symbol = pos.symbol;
        sector = sectorMap.get(symbol) || "Other";
      }

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
      sectors[sector].positions.push({
        symbol: pos.symbol,
        value: marketValue,
        invested: costBasis,
        gain,
        gainPercent,
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
    <div className={`${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-primary" />
            Portfolio Allocation by Sector
            {loading && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Loading...
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Donut Chart */}
            <div className="flex items-center justify-center col-span-1">
              <div className="relative w-full max-w-[320px] aspect-square">
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
                      onMouseEnter={(_, index) =>
                        setHoveredSector(sectorData[index].name)
                      }
                      onMouseLeave={() => setHoveredSector(null)}
                    >
                      {sectorData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="#1a1d1f"
                          strokeWidth={2}
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
                  <span className="text-xs text-muted-foreground">
                    Total Value
                  </span>
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sector Table */}
            <div className="overflow-x-auto col-span-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light dark:border-border-dark">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                      Name
                    </th>
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
                  </tr>
                </thead>
                <tbody>
                  {sectorData.map((sector) => {
                    const isPositive = sector.gain >= 0;
                    const allocation =
                      totalValue > 0 ? (sector.value / totalValue) * 100 : 0;
                    const isHovered = hoveredSector === sector.name;

                    return (
                      <tr
                        key={sector.name}
                        className={`border-b border-border-light dark:border-border-dark transition-colors ${
                          isHovered ? "bg-primary/10" : "hover:bg-muted/30"
                        }`}
                        onMouseEnter={() => setHoveredSector(sector.name)}
                        onMouseLeave={() => setHoveredSector(null)}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
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
                              color: isPositive ? "#22c55e" : "#ef4444",
                            }}
                          >
                            {isPositive ? "" : "-"}
                            {formatCurrency(Math.abs(sector.gain))}
                          </div>
                          <div className="flex items-center justify-end gap-0.5">
                            {isPositive ? (
                              <TrendingUp className="w-3 h-3 text-green-500" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-500" />
                            )}
                            <span
                              className="text-xs"
                              style={{
                                color: isPositive ? "#22c55e" : "#ef4444",
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PortfolioAllocation;
