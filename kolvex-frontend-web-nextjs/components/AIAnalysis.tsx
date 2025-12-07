"use client";

import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { TradingSignal } from "@/lib/kolTweetsApi";
import { cn } from "@/lib/utils";

interface AIAnalysisProps {
  summary?: string | null;
  tradingSignal?: TradingSignal | null;
  model?: string | null;
  analyzedAt?: string | null;
}

export default function AIAnalysis({
  summary,
  tradingSignal,
  model,
  analyzedAt,
}: AIAnalysisProps) {
  // If no summary and no trading signal, don't render anything
  if (!summary && !tradingSignal?.action) {
    return null;
  }

  // Get badge config based on signal action
  const getSignalConfig = (action?: string | null) => {
    if (!action || action === "null") return null;

    const normalizedAction = action.toLowerCase();

    switch (normalizedAction) {
      case "buy":
        return {
          label: "BUY",
          icon: TrendingUp,
          className:
            "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30",
          iconClass: "text-green-600 dark:text-green-400",
        };
      case "sell":
        return {
          label: "SELL",
          icon: TrendingDown,
          className:
            "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30",
          iconClass: "text-red-600 dark:text-red-400",
        };
      case "hold":
        return {
          label: "HOLD",
          icon: Minus,
          className:
            "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-500/30",
          iconClass: "text-gray-600 dark:text-gray-400",
        };
      default:
        return null;
    }
  };

  const signalConfig = getSignalConfig(tradingSignal?.action);
  const SignalIcon = signalConfig?.icon;

  // Construct display text (Summary + Trading Reasoning)
  let analysisText = "";

  // Summary
  if (summary) {
    analysisText = summary;
  }

  // Trading Reasoning
  if (tradingSignal?.reasoning) {
    if (analysisText) {
      analysisText += "\n\n";
    }
    // Add prefix only if we have summary as well, to distinguish
    if (summary) {
      analysisText += "Trading Analysis: ";
    }
    analysisText += tradingSignal.reasoning;
  }

  // Default text
  if (!analysisText.trim()) {
    analysisText = "Analysis completed - No significant summary details.";
  }

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full mt-2"
      defaultValue="ai-analysis"
    >
      <AccordionItem
        value="ai-analysis"
        className="border rounded-lg bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
      >
        <AccordionTrigger className="p-2 hover:no-underline">
          <div className="flex flex-1 items-center justify-between pr-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Sparkles className="w-3 h-3 text-primary mr-2" />
                <h4 className="font-semibold text-xs text-gray-900 dark:text-white">
                  AI Analysis
                </h4>
              </div>

              {/* Trading Signal Badge */}
              {signalConfig && (
                <div
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ml-1",
                    signalConfig.className
                  )}
                >
                  {SignalIcon && (
                    <SignalIcon
                      className={cn("w-3 h-3", signalConfig.iconClass)}
                    />
                  )}
                  {signalConfig.label}
                  {tradingSignal?.confidence && (
                    <span className="ml-0.5 opacity-80 font-medium">
                      {Math.round(tradingSignal.confidence * 100)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-2 pb-2">
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {analysisText}
          </p>
          {/* 
          {(model || analyzedAt) && (
            <div className="flex items-center gap-2 text-[10px] text-gray-400 border-t border-gray-200 dark:border-white/10 pt-2 mt-2">
              {model && <span>Model: {model.split("/").pop()}</span>}
              {analyzedAt && (
                <span>Analyzed: {new Date(analyzedAt).toLocaleString()}</span>
              )}
            </div>
          )} */}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
