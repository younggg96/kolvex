"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";

export type SentimentType = "bullish" | "bearish";

interface SentimentBadgeProps {
  score?: number;
  showIcon?: boolean;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  clickable?: boolean;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const getSentimentColor = (score?: number) => {
  if (score === undefined || score === null)
    return "text-gray-500 dark:text-white/50";
  if (score > 0) return "text-green-600 dark:text-green-400";
  if (score < 0) return "text-red-600 dark:text-red-400";
  return "text-gray-500 dark:text-white/50";
};

const getSentimentBgColor = (score?: number) => {
  if (score === undefined || score === null)
    return "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10";
  if (score > 0)
    return "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20";
  if (score < 0)
    return "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20";
  return "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10";
};

const getSentimentText = (score?: number) => {
  if (score === undefined || score === null) return "Neutral";
  if (score > 0) return "Bullish";
  if (score < 0) return "Bearish";
  return "Neutral";
};

const getSentimentType = (score?: number): SentimentType | null => {
  if (score === undefined || score === null || score === 0) return null;
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return null;
};

const getSentimentIcon = (score?: number) => {
  if (score === undefined || score === null) return Minus;
  if (score > 0) return TrendingUp;
  if (score < 0) return TrendingDown;
  return Minus;
};

const sizeConfig = {
  sm: {
    badge: "py-0.5 px-1.5 text-[12px]",
    icon: "w-3 h-3",
    gap: "gap-0.5",
  },
  md: {
    badge: "py-1 px-2 text-sm",
    icon: "w-3.5 h-3.5",
    gap: "gap-1",
  },
  lg: {
    badge: "py-1.5 px-3 text-base",
    icon: "w-4 h-4",
    gap: "gap-1.5",
  },
};

export function SentimentBadge({
  score,
  showIcon = true,
  showPercentage = true,
  size = "md",
  className,
  clickable = false,
  href,
  onClick,
}: SentimentBadgeProps) {
  const Icon = getSentimentIcon(score);
  const config = sizeConfig[size];
  const sentimentType = getSentimentType(score);

  const badgeContent = (
    <>
      {showIcon && <Icon className={config.icon} />}
      <span>{getSentimentText(score)}</span>
      {showPercentage && score !== undefined && score !== null && (
        <span className="opacity-75">({Math.abs(score).toFixed(0)}%)</span>
      )}
    </>
  );

  const badgeClasses = cn(
    "inline-flex items-center justify-center border rounded-full font-medium",
    config.badge,
    config.gap,
    getSentimentBgColor(score),
    getSentimentColor(score),
    clickable && "cursor-pointer hover:opacity-80 transition-opacity",
    className
  );

  // If href is provided, use Link
  if (href) {
    return (
      <Link
        href={href}
        className={badgeClasses}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
      >
        {badgeContent}
      </Link>
    );
  }

  // If clickable but no href, use button-like div
  if (clickable || onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={badgeClasses}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.(e as unknown as React.MouseEvent);
          }
        }}
      >
        {badgeContent}
      </div>
    );
  }

  // Default non-clickable badge
  return <div className={badgeClasses}>{badgeContent}</div>;
}

// Export helper functions for external use
export {
  getSentimentColor,
  getSentimentText,
  getSentimentBgColor,
  getSentimentType,
};
