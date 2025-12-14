"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { NewsArticle } from "@/lib/kolTweetsApi";
import { ExternalLink } from "lucide-react";

interface NewsCardProps {
  article: NewsArticle;
}

export default function NewsCard({ article }: NewsCardProps) {
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

  return (
    <div className="group relative rounded-xl border border-transparent hover:border-border/40 hover:bg-muted/20 transition-all duration-300 overflow-hidden">
      <div className="py-4 flex flex-col gap-2.5">
        {/* Meta Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary uppercase tracking-wide">
              {article.source}
            </span>
            <span className="text-[10px] text-muted-foreground/60">•</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {formatNewsDate(article.published_at)}
            </span>
          </div>

          <Link
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded-md hover:bg-muted/50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
          </Link>
        </div>

        {/* Content - clickable to open article */}
        <Link
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block space-y-1.5"
        >
          <h4 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors duration-200">
            {article.title}
          </h4>
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
            {article.summary}
          </p>
        </Link>

        {/* Tickers */}
        {article.tickers && article.tickers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(showAllTickers
              ? article.tickers
              : article.tickers.slice(0, 6)
            ).map((ticker, index) => (
              <Link
                key={index}
                href={`/dashboard/stock/${ticker}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                ${ticker}
              </Link>
            ))}
            {article.tickers.length > 6 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllTickers(!showAllTickers);
                }}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-muted-foreground/60 hover:text-primary hover:bg-muted/50 transition-colors"
              >
                {showAllTickers
                  ? "Show less"
                  : `+${article.tickers.length - 6}`}
              </button>
            )}
          </div>
        )}

        {/* Footer Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
            {article.tags.map((tag, index) => (
              <Link
                key={index}
                href={`/dashboard/news/tag/${encodeURIComponent(tag)}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-muted-foreground/60 font-medium hover:text-primary transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
