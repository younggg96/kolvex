"use client";

import { cn } from "@/lib/utils";

interface AccuracyRingProps {
  percentage: number | null;
}

export function AccuracyRing({ percentage }: AccuracyRingProps) {
  const radius = 36;
  const stroke = 5;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    percentage !== null
      ? circumference - (percentage / 100) * circumference
      : circumference;

  const getColor = (pct: number | null) => {
    if (pct === null) return "text-muted-foreground";
    if (pct >= 70) return "text-green-500";
    if (pct >= 50) return "text-amber-500";
    return "text-red-500";
  };

  const getBgColor = (pct: number | null) => {
    if (pct === null) return "bg-gray-50 dark:bg-white/5";
    if (pct >= 70) return "bg-green-50 dark:bg-green-500/10";
    if (pct >= 50) return "bg-amber-50 dark:bg-amber-500/10";
    return "bg-red-50 dark:bg-red-500/10";
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full p-2",
        getBgColor(percentage)
      )}
    >
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        {/* Background ring */}
        <circle
          stroke="currentColor"
          className="text-gray-200 dark:text-white/10"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress ring */}
        <circle
          stroke="currentColor"
          className={cn("transition-all duration-700", getColor(percentage))}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference + " " + circumference}
          style={{ strokeDashoffset }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn("text-lg font-bold tabular-nums", getColor(percentage))}
        >
          {percentage !== null ? `${percentage.toFixed(0)}%` : "—"}
        </span>
      </div>
    </div>
  );
}

