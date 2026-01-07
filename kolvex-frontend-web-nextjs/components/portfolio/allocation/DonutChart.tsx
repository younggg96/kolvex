"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { DonutChartProps, SectorData } from "./types";
import { formatCurrency } from "./utils";

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

// ================== DONUT CHART COMPONENT ==================

export function DonutChart({
  sectorData,
  totalValue,
  hoveredSector,
  setHoveredSector,
  toggleSector,
}: DonutChartProps) {
  return (
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
                    hoveredSector === null || hoveredSector === entry.name
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
        <span className="text-xs text-muted-foreground">Total Value</span>
        <span className="text-xl font-bold text-foreground">
          {formatCurrency(totalValue)}
        </span>
      </div>
    </div>
  );
}

export default DonutChart;

