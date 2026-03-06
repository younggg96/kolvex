"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
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
  Languages,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { useTranslation } from "@/lib/i18n";

interface NewsCardProps {
  article: NewsArticle;
}

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  benzinga: {
    label: "Benzinga",
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  yahoo_finance: {
    label: "Yahoo",
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  reuters: {
    label: "Reuters",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  cnbc: {
    label: "CNBC",
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  marketwatch: {
    label: "MarketWatch",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  rss_feed: {
    label: "RSS",
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
  financial_juice: {
    label: "FJ",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  default: {
    label: "News",
    className: "bg-primary/10 text-primary",
  },
};

function getSourceConfig(source: string) {
  const key = source.toLowerCase();
  return SOURCE_CONFIG[key] || SOURCE_CONFIG.default;
}

function getSentimentKey(sentiment: string | null | undefined): string | null {
  if (!sentiment) return null;
  const lower = sentiment.toLowerCase();
  if (lower === "bullish" || lower === "bearish" || lower === "neutral")
    return lower;
  return null;
}

const SENTIMENT_ICON: Record<string, typeof TrendingUp> = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  neutral: Minus,
};

const SENTIMENT_CLASS: Record<string, string> = {
  bullish: "bg-green-500/10 text-green-600 dark:text-green-400",
  bearish: "bg-red-500/10 text-red-600 dark:text-red-400",
  neutral: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const IMPACT_CLASS: Record<string, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-green-500",
};

async function translateText(
  text: string,
  targetLang: string
): Promise<string> {
  if (!text || !text.trim()) return text;
  const tl = targetLang === "zh" ? "zh-CN" : "en";
  const response = await fetch(
    `/api/translate?tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`
  );
  if (!response.ok) throw new Error("Translation request failed");
  const data = await response.json();
  return data.translated;
}

export default function NewsCard({ article }: NewsCardProps) {
  const [mounted, setMounted] = useState(false);
  const { t, locale } = useTranslation();

  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedSummary, setTranslatedSummary] = useState("");
  const [translatedAiSummary, setTranslatedAiSummary] = useState("");
  const [translatedKeyPoints, setTranslatedKeyPoints] = useState<string[]>([]);
  const translatedForLocale = useRef<string | null>(null);
  const articleRef = useRef(article);
  articleRef.current = article;

  useEffect(() => {
    setMounted(true);
  }, []);

  const articleFingerprint = article.summary + (article.ai_summary ?? "");

  useEffect(() => {
    let cancelled = false;

    setTranslatedSummary("");
    setTranslatedAiSummary("");
    setTranslatedKeyPoints([]);
    translatedForLocale.current = null;
    setShowTranslated(false);

    if (locale === "en") {
      setIsTranslating(false);
      return;
    }

    const run = async () => {
      setIsTranslating(true);
      try {
        const art = articleRef.current;
        const promises: Promise<string>[] = [];
        promises.push(translateText(art.summary, locale));

        if (art.ai_summary) {
          promises.push(translateText(art.ai_summary, locale));
        }

        if (art.key_points && art.key_points.length > 0) {
          promises.push(translateText(art.key_points.join("\n---\n"), locale));
        }

        const results = await Promise.all(promises);
        if (cancelled) return;

        let idx = 0;
        setTranslatedSummary(results[idx++]);
        if (art.ai_summary) {
          setTranslatedAiSummary(results[idx++]);
        }
        if (art.key_points && art.key_points.length > 0) {
          setTranslatedKeyPoints(results[idx].split(/\n?---\n?/));
        }

        translatedForLocale.current = locale;
        setShowTranslated(true);
      } catch (error) {
        console.error("Translation failed:", error);
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, articleFingerprint]);

  const handleToggleTranslation = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isTranslating) return;

      if (showTranslated) {
        setShowTranslated(false);
        return;
      }

      if (translatedForLocale.current) {
        setShowTranslated(true);
        return;
      }

      const targetLang = locale === "en" ? "zh" : locale;
      setIsTranslating(true);

      const art = articleRef.current;
      const promises: Promise<string>[] = [];
      promises.push(translateText(art.summary, targetLang));
      if (art.ai_summary) {
        promises.push(translateText(art.ai_summary, targetLang));
      }
      if (art.key_points && art.key_points.length > 0) {
        promises.push(translateText(art.key_points.join("\n---\n"), targetLang));
      }

      Promise.all(promises)
        .then((results) => {
          let idx = 0;
          setTranslatedSummary(results[idx++]);
          if (art.ai_summary) {
            setTranslatedAiSummary(results[idx++]);
          }
          if (art.key_points && art.key_points.length > 0) {
            setTranslatedKeyPoints(results[idx].split(/\n?---\n?/));
          }
          translatedForLocale.current = targetLang;
          setShowTranslated(true);
        })
        .catch((err) => console.error("Translation failed:", err))
        .finally(() => setIsTranslating(false));
    },
    [isTranslating, showTranslated, locale]
  );

  const formatNewsDate = (dateString: string) => {
    if (!mounted) {
      return new Date(dateString).toLocaleDateString();
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return t("news.card.justNow");
    if (diffInSeconds < 3600)
      return t("news.card.minutesAgo", {
        count: String(Math.floor(diffInSeconds / 60)),
      });
    if (diffInSeconds < 86400)
      return t("news.card.hoursAgo", {
        count: String(Math.floor(diffInSeconds / 3600)),
      });
    if (diffInSeconds < 604800)
      return t("news.card.daysAgo", {
        count: String(Math.floor(diffInSeconds / 86400)),
      });
    return date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const sourceConfig = getSourceConfig(article.source);
  const sentimentKey = getSentimentKey(article.sentiment);
  const impactKey = article.market_impact?.toLowerCase() ?? null;
  const hasAIAnalysis = !!article.analyzed_at;
  const isHighRelevance =
    article.us_market_relevance === "high" ||
    (hasAIAnalysis && article.market_impact?.toLowerCase() === "high");
  const isLowRelevance =
    hasAIAnalysis && article.us_market_relevance === "low";

  const sentimentLabel = sentimentKey
    ? t(`news.card.${sentimentKey}`)
    : null;
  const sentimentClass = sentimentKey ? SENTIMENT_CLASS[sentimentKey] : null;
  const SentimentIcon = sentimentKey ? SENTIMENT_ICON[sentimentKey] : null;

  const impactLabel =
    impactKey && IMPACT_CLASS[impactKey]
      ? t(
        `news.card.${impactKey === "high" ? "highImpact" : impactKey === "medium" ? "mediumImpact" : "lowImpact"}`
      )
      : null;
  const impactClass =
    impactKey && IMPACT_CLASS[impactKey] ? IMPACT_CLASS[impactKey] : null;

  const displaySummary =
    showTranslated && translatedSummary ? translatedSummary : article.summary;
  const displayAiSummary =
    showTranslated && translatedAiSummary
      ? translatedAiSummary
      : article.ai_summary;
  const displayKeyPoints =
    showTranslated && translatedKeyPoints.length > 0
      ? translatedKeyPoints
      : article.key_points;

  return (
    <div
      className={`group relative rounded-lg border backdrop-blur-sm px-3 py-2.5 transition-all duration-200 ${isHighRelevance
        ? "border-primary/40 bg-primary/[0.03] dark:bg-primary/[0.06] ring-1 ring-primary/20 hover:border-primary/60"
        : isLowRelevance
          ? "border-border/30 dark:border-border-dark/30 bg-card-light/50 dark:bg-card-dark/30 opacity-60 hover:opacity-100"
          : "border-border/50 dark:border-border-dark/50 bg-card-light dark:bg-card-dark/50 hover:border-border"
        } hover:bg-card/80`}
    >
      {/* Header + Content inline */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {isHighRelevance && (
            <>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[10px] font-semibold leading-none bg-primary/15 text-primary">
                <Zap className="w-2.5 h-2.5" />
                US
              </span>
            </>
          )}
          <span className="text-[11px] text-muted-foreground flex-shrink-0">
            {formatNewsDate(article.published_at)}
          </span>
        </div>

        <div className="flex items-center flex-shrink-0">
          <div
            onClick={handleToggleTranslation}
            onKeyDown={(e) => {
              if (!isTranslating && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                handleToggleTranslation(e as any);
              }
            }}
            role="button"
            tabIndex={isTranslating ? -1 : 0}
            aria-label={
              showTranslated
                ? t("news.card.showOriginal")
                : t("news.card.translate")
            }
            title={
              showTranslated
                ? t("news.card.showOriginal")
                : t("news.card.translate")
            }
            className={`p-1 rounded transition-colors cursor-pointer ${showTranslated
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } ${isTranslating ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Languages
              className={`w-3 h-3 ${isTranslating ? "animate-pulse" : ""}`}
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <p className="text-[13px] text-foreground/90 line-clamp-2 leading-snug mb-1.5">
        {displaySummary}
      </p>

      {/* AI Analysis Block (Accordion - default closed) */}
      {hasAIAnalysis && (
        <Accordion type="single" collapsible className="w-full mb-1.5">
          <AccordionItem
            value="ai-analysis"
            className="border rounded bg-muted/30 border-border/30 dark:border-border-dark/30"
          >
            <AccordionTrigger className="px-2.5 py-1.5 hover:no-underline">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[11px] font-semibold text-foreground">
                  {t("news.card.aiAnalysis")}
                </span>
                {sentimentLabel && sentimentClass && SentimentIcon && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[10px] font-semibold leading-none ${sentimentClass}`}
                  >
                    <SentimentIcon className="w-2.5 h-2.5" />
                    {sentimentLabel}
                  </span>
                )}
                {article.trading_action && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[10px] font-semibold uppercase leading-none ${article.trading_action === "buy"
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

            <AccordionContent className="px-2.5 pb-2">
              <div className="space-y-2">
                {displayAiSummary && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      {t("news.card.summary")}
                    </p>
                    <p className="text-[11px] text-foreground/90 leading-snug">
                      {displayAiSummary}
                    </p>
                  </div>
                )}

                {displayKeyPoints && displayKeyPoints.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      {t("news.card.keyPoints")}
                    </p>
                    <ul className="space-y-0.5">
                      {displayKeyPoints.map((point, index) => (
                        <li
                          key={index}
                          className="text-[11px] text-foreground/80 flex items-start gap-1"
                        >
                          <span className="text-primary mt-px">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(sentimentLabel || impactLabel || article.trading_action) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1.5 border-t border-border/20 dark:border-border-dark/20">
                    {sentimentLabel && sentimentClass && SentimentIcon && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {t("news.card.sentiment")}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[10px] font-semibold leading-none ${sentimentClass}`}
                        >
                          <SentimentIcon className="w-2.5 h-2.5" />
                          {sentimentLabel}
                        </span>
                        {article.sentiment_confidence && (
                          <span className="text-[10px] text-muted-foreground">
                            {Math.round(article.sentiment_confidence * 100)}%
                          </span>
                        )}
                      </div>
                    )}

                    {impactLabel && impactClass && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {t("news.card.marketImpact")}
                        </span>
                        <AlertTriangle
                          className={`w-3 h-3 ${impactClass}`}
                        />
                        <span
                          className={`text-[10px] font-medium ${impactClass}`}
                        >
                          {impactLabel}
                        </span>
                      </div>
                    )}

                    {article.trading_action && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {t("news.card.tradingSignal")}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[10px] font-semibold uppercase leading-none ${article.trading_action === "buy"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : article.trading_action === "sell"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                        >
                          <Zap className="w-2.5 h-2.5" />
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

    </div>
  );
}
