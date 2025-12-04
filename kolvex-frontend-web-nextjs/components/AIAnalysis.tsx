"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import TranslateButton from "./TranslateButton";
import { toast } from "sonner";

interface AIAnalysisProps {
  aiAnalysis?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  postId?: string;
}

export default function AIAnalysis({
  aiAnalysis,
  sentiment = "neutral",
  postId,
}: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState(aiAnalysis || "");
  const [currentSentiment, setCurrentSentiment] = useState(sentiment);
  const [displayText, setDisplayText] = useState(aiAnalysis || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (aiAnalysis) {
      setAnalysis(aiAnalysis);
      setDisplayText(aiAnalysis);
    }
    setCurrentSentiment(sentiment);
  }, [aiAnalysis, sentiment]);

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!postId) return;

    try {
      setIsLoading(true);
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tweet_id: postId }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data = await response.json();

      if (data.analysis) {
        // Map backend sentiment to frontend format
        let newSentiment: "bullish" | "bearish" | "neutral" = "neutral";
        if (data.analysis.sentiment?.sentiment === "positive")
          newSentiment = "bullish";
        if (data.analysis.sentiment?.sentiment === "negative")
          newSentiment = "bearish";

        const newAnalysis =
          data.analysis.sentiment?.reasoning ||
          data.analysis.summary ||
          "Analysis completed";

        setAnalysis(newAnalysis);
        setDisplayText(newAnalysis);
        setCurrentSentiment(newSentiment);
        toast.success("AI Analysis completed");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze tweet");
    } finally {
      setIsLoading(false);
    }
  };

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

  if (!analysis && !postId) return null;

  if (!analysis) {
    return (
      <div className="mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAnalyze}
          disabled={isLoading}
          className="w-full justify-center text-xs h-8 gap-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3" />
              Analyze with AI
            </>
          )}
        </Button>
      </div>
    );
  }

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
              {getSentimentBadge(currentSentiment)}
            </div>
            <TranslateButton text={analysis} onTranslate={handleTranslate} />
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
