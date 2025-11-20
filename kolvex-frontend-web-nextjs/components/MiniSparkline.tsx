"use client";

import { useMemo } from "react";

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export default function MiniSparkline({
  data,
  width = 80,
  height = 24,
  color,
  strokeWidth = 1.5,
  className = "",
}: MiniSparklineProps) {
  const pathData = useMemo(() => {
    if (!data || data.length === 0) return "";

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  }, [data, width, height]);

  // Determine color based on trend
  const isPositive = data.length >= 2 && data[data.length - 1] >= data[0];
  const strokeColor = color || (isPositive ? "#00C805" : "#ef4444");

  if (!data || data.length === 0) {
    return (
      <div className={`${className}`} style={{ width, height }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.2}
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={className} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {/* Gradient fill */}
        <defs>
          <linearGradient
            id={`gradient-${data.join("-")}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <path
          d={`${pathData} L ${width},${height} L 0,${height} Z`}
          fill={`url(#gradient-${data.join("-")})`}
        />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
