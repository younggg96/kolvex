"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import TranslateButton from "./TranslateButton";

interface AIAnalysisProps {
  aiAnalysis?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
}

export default function AIAnalysis({
  aiAnalysis,
  sentiment = "neutral",
}: AIAnalysisProps) {
  const [displayText, setDisplayText] = useState(aiAnalysis || "");

  useEffect(() => {
    setDisplayText(aiAnalysis || "");
  }, [aiAnalysis]);

  if (!aiAnalysis) return null;

  const handleTranslate = (translated: string) => {
    setDisplayText(translated);
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case "bullish":
        return (
          <div className="ml-3 rounded px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-500 border border-green-500/40 flex items-center gap-1">
            Bullish <div className="w-1 h-1 bg-green-500 rounded-full"></div>
          </div>
        );
      case "bearish":
        return (
          <div className="ml-3 rounded px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-500 border border-red-500/40 flex items-center gap-1">
            Bearish <div className="w-1 h-1 bg-red-500 rounded-full"></div>
          </div>
        );
      default:
        return (
          <div className="ml-3 rounded px-2 py-0.5 text-xs font-medium bg-gray-500/20 text-gray-500 border border-gray-500/40 flex items-center gap-1">
            Neutral <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
          </div>
        );
    }
  };

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      defaultValue="ai-analysis"
    >
      <AccordionItem
        value="ai-analysis"
        className="border rounded-lg bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
      >
        <AccordionTrigger className="p-2 hover:no-underline">
          <div className="flex flex-1 items-center justify-between pr-2">
            <div className="flex items-center">
              <Sparkles className="w-3 h-3 text-primary mr-2" />
              <h4 className="font-semibold text-xs text-gray-900 dark:text-white">
                AI Analysis
              </h4>
              {getSentimentBadge(sentiment)}
            </div>
            <TranslateButton text={aiAnalysis} onTranslate={handleTranslate} />
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-2 pb-2">
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
            {displayText}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
