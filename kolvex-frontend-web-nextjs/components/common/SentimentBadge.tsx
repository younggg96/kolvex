"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { SentimentAnalysis } from "@/lib/kolTweetsApi";

interface SentimentBadgeProps {
  sentiment: SentimentAnalysis | null | undefined;
  className?: string;
}

const sentimentConfig = {
  bullish: {
    label: "Bullish",
    icon: TrendingUp,
    bgColor: "bg-green-100 dark:bg-green-500/20",
    textColor: "text-green-700 dark:text-green-400",
    iconColor: "text-green-600 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-500/30",
  },
  positive: {
    label: "Bullish",
    icon: TrendingUp,
    bgColor: "bg-green-100 dark:bg-green-500/20",
    textColor: "text-green-700 dark:text-green-400",
    iconColor: "text-green-600 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-500/30",
  },
  bearish: {
    label: "Bearish",
    icon: TrendingDown,
    bgColor: "bg-red-100 dark:bg-red-500/20",
    textColor: "text-red-700 dark:text-red-400",
    iconColor: "text-red-600 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-500/30",
  },
  negative: {
    label: "Bearish",
    icon: TrendingDown,
    bgColor: "bg-red-100 dark:bg-red-500/20",
    textColor: "text-red-700 dark:text-red-400",
    iconColor: "text-red-600 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-500/30",
  },
  neutral: {
    label: "Neutral",
    icon: Minus,
    bgColor: "bg-gray-100 dark:bg-gray-500/20",
    textColor: "text-gray-700 dark:text-gray-400",
    iconColor: "text-gray-600 dark:text-gray-400",
    borderColor: "border-gray-200 dark:border-gray-500/30",
  },
};

export default function SentimentBadge({
  sentiment,
  className,
}: SentimentBadgeProps) {
  if (!sentiment?.value) {
    return null;
  }

  const config =
    sentimentConfig[sentiment.value as keyof typeof sentimentConfig] ||
    sentimentConfig.neutral;

  const Icon = config.icon;
  const confidencePercent = sentiment.confidence
    ? Math.round(sentiment.confidence * 100)
    : null;

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-default",
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
    >
      <Icon className={cn("w-3 h-3", config.iconColor)} />
      <span>{config.label}</span>
      {confidencePercent !== null && (
        <span className="opacity-70">({confidencePercent}%)</span>
      )}
    </div>
  );

  // If there's no reasoning, just show the badge without hover
  if (!sentiment.reasoning) {
    return badge;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{badge}</HoverCardTrigger>
      <HoverCardContent
        className="w-80 p-3"
        side="top"
        align="start"
        sideOffset={8}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon className={cn("w-4 h-4", config.iconColor)} />
            <span className={cn("font-semibold text-sm", config.textColor)}>
              {config.label}
            </span>
            {confidencePercent !== null && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {confidencePercent}% confidence
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {sentiment.reasoning}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

