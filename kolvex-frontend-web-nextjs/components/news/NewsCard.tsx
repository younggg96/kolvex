"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { NewsArticle } from "@/lib/kolPostsApi";
import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Tags } from "../common";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

interface NewsCardProps {
  article: NewsArticle;
  key?: any;
}

// Source display configuration
const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  benzinga: {
    label: "Benzinga",
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  yahoo_finance: {
    label: "Yahoo",
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  default: {
    label: "News",
    className: "bg-primary/10 text-primary",
  },
};

// Sentiment display configuration
const SENTIMENT_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof TrendingUp }
> = {
  bullish: {
    label: "Bullish",
    className: "bg-green-500/10 text-green-600 dark:text-green-400",
    icon: TrendingUp,
  },
  bearish: {
    label: "Bearish",
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
    icon: TrendingDown,
  },
  neutral: {
    label: "Neutral",
    className: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
    icon: Minus,
  },
};

// Market impact configuration
const IMPACT_CONFIG: Record<string, { label: string; className: string }> = {
  high: {
    label: "High Impact",
    className: "text-red-500",
  },
  medium: {
    label: "Medium",
    className: "text-amber-500",
  },
  low: {
    label: "Low",
    className: "text-green-500",
  },
};

function getSourceConfig(source: string) {
  const key = source.toLowerCase();
  return SOURCE_CONFIG[key] || SOURCE_CONFIG.default;
}

function getSentimentConfig(sentiment: string | null | undefined) {
  if (!sentiment) return null;
  return SENTIMENT_CONFIG[sentiment.toLowerCase()] || null;
}

function getImpactConfig(impact: string | null | undefined) {
  if (!impact) return null;
  return IMPACT_CONFIG[impact.toLowerCase()] || null;
}

export default function NewsCard({ article, key = "" }: NewsCardProps) {
  const [mounted, setMounted] = useState(false);
  const [showAllTickers, setShowAllTickers] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatNewsDate = (dateString: string) => {
    if (!mounted) {
      return new Date(dateString).toLocaleDateString();
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const sourceConfig = getSourceConfig(article.source);
  const sentimentConfig = getSentimentConfig(article.sentiment);
  const impactConfig = getImpactConfig(article.market_impact);
  const hasAIAnalysis = !!article.analyzed_at;

  return (
    <div
      className="group relative rounded-xl border border-border/50 dark:border-border-dark/50 bg-card-light dark:bg-card-dark/50 backdrop-blur-sm p-4 hover:border-border hover:bg-card/80 transition-all duration-200"
      key={key}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${sourceConfig.className}`}
          >
            {sourceConfig.label}
          </span>

          {/* AI Analyzed indicator */}
          {hasAIAnalysis && (
            <>
              <span className="text-[10px] text-muted-foreground/60">•</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            </>
          )}

          <span className="text-[10px] text-muted-foreground/60">•</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatNewsDate(article.published_at)}
          </span>
        </div>

        <Link
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Content */}
      <div className="block mb-3">
        <h4 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors duration-200 mb-1.5">
          {article.title}
        </h4>
        <p className="text-sm text-foreground/90 line-clamp-2 leading-relaxed">
          {article.summary}
        </p>
      </div>

      {/* AI Analysis Block (Accordion - default open) */}
      {hasAIAnalysis && (
        <Accordion
          type="single"
          collapsible
          className="w-full mb-3"
          defaultValue="ai-analysis"
        >
          <AccordionItem
            value="ai-analysis"
            className="border rounded-lg bg-muted/30 border-border/30 dark:border-border-dark/30"
          >
            <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  AI Analysis
                </span>
                {/* Quick badges in trigger */}
                {sentimentConfig && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${sentimentConfig.className}`}
                  >
                    <sentimentConfig.icon className="w-2.5 h-2.5" />
                    {sentimentConfig.label}
                  </span>
                )}
                {article.trading_action && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${article.trading_action === "buy"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : article.trading_action === "sell"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                  >
                    {article.trading_action}
                  </span>
                )}
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-3 pb-3">
              <div className="space-y-3">
                {/* AI Summary */}
                {article.ai_summary && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Summary
                    </p>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {article.ai_summary}
                    </p>
                  </div>
                )}

                {/* Key Points */}
                {article.key_points && article.key_points.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Key Points
                    </p>
                    <ul className="space-y-1">
                      {article.key_points.map((point, index) => (
                        <li
                          key={index}
                          className="text-xs text-foreground/80 flex items-start gap-1.5"
                        >
                          <span className="text-primary mt-0.5">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Analysis Details Grid */}
                {(sentimentConfig || impactConfig || article.trading_action) && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/20 dark:border-border-dark/20">
                    {/* Sentiment */}
                    {sentimentConfig && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Sentiment
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${sentimentConfig.className}`}
                          >
                            <sentimentConfig.icon className="w-3 h-3" />
                            {sentimentConfig.label}
                          </span>
                          {article.sentiment_confidence && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(article.sentiment_confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Market Impact */}
                    {impactConfig && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Market Impact
                        </p>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle
                            className={`w-3.5 h-3.5 ${impactConfig.className}`}
                          />
                          <span
                            className={`text-xs font-medium ${impactConfig.className}`}
                          >
                            {impactConfig.label}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Trading Signal */}
                    {article.trading_action && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Trading Signal
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold uppercase ${article.trading_action === "buy"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : article.trading_action === "sell"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                        >
                          <Zap className="w-3 h-3" />
                          {article.trading_action}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Footer */}
      <div className="pt-3 border-t border-border/30 dark:border-border-dark/30">
        {/* Tickers - prioritize AI tickers if available */}
        {((article.ai_tickers && article.ai_tickers.length > 0) ||
          (article.tickers && article.tickers.length > 0)) && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(showAllTickers
                ? article.ai_tickers?.length
                  ? article.ai_tickers
                  : article.tickers
                : (article.ai_tickers?.length
                  ? article.ai_tickers
                  : article.tickers
                ).slice(0, 6)
              ).map((ticker, index) => (
                <Tags key={index} tags={[`$${ticker}`]} />
              ))}
              {(article.ai_tickers?.length
                ? article.ai_tickers
                : article.tickers
              ).length > 6 && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllTickers(!showAllTickers);
                    }}
                    variant="ghost"
                    size="xs"
                    className="text-xs"
                  >
                    {showAllTickers
                      ? "Show less"
                      : `+${(article.ai_tickers?.length ? article.ai_tickers : article.tickers).length - 6}`}
                  </Button>
                )}
            </div>
          )}

        {/* Tags - show AI tags if available */}
        {((article.ai_tags && article.ai_tags.length > 0) ||
          article.tags.length > 0) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {(article.ai_tags?.length ? article.ai_tags : article.tags).map(
                (tag, index) => (
                  <Link
                    key={index}
                    href={`/dashboard/news/tag/${encodeURIComponent(tag)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-muted-foreground font-medium hover:text-primary transition-colors"
                  >
                    #{tag}
                  </Link>
                )
              )}
            </div>
          )}
      </div>
    </div>
  );
}
