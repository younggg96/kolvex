"use client";

import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIAnalysisResult } from "@/lib/stockScreenerApi";

interface AIInsightPanelProps {
  result: AIAnalysisResult | null;
  loading: boolean;
  locale: string;
}

const DIMENSION_LABELS: Record<string, { en: string; zh: string }> = {
  fundamental: { en: "Fundamental", zh: "基本面" },
  valuation: { en: "Valuation", zh: "估值" },
  growth: { en: "Growth", zh: "成长性" },
  risk: { en: "Risk", zh: "风险" },
};

function ScoreBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 text-right">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            value >= 75
              ? "bg-green-500"
              : value >= 50
              ? "bg-yellow-500"
              : "bg-red-500"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-medium tabular-nums w-6 text-right">
        {value}
      </span>
    </div>
  );
}

export default function AIInsightPanel({
  result,
  loading,
  locale,
}: AIInsightPanelProps) {
  const isZh = locale === "zh";

  if (loading) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <p className="text-sm text-primary font-medium">
          {isZh ? "AI 正在分析..." : "AI is analyzing..."}
        </p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/10 bg-primary/5">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          {isZh ? "AI 智能洞察" : "AI Insights"}
        </h3>
      </div>

      {/* Summary */}
      {result.summary && (
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs leading-relaxed text-foreground/90">
            {result.summary}
          </p>
        </div>
      )}

      {/* Stock scores grid */}
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {result.stocks.map((stock) => (
          <div
            key={stock.symbol}
            className="rounded-lg border border-border p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {stock.symbol}
              </span>
              <div
                className={cn(
                  "h-6 min-w-[40px] rounded-full flex items-center justify-center text-[11px] font-bold text-white",
                  stock.ai_score >= 75
                    ? "bg-green-500"
                    : stock.ai_score >= 50
                    ? "bg-yellow-500"
                    : "bg-red-500"
                )}
              >
                {stock.ai_score}
              </div>
            </div>

            {/* Dimension bars */}
            <div className="space-y-1">
              {Object.entries(stock.dimension_scores).map(([dim, val]) => (
                <ScoreBar
                  key={dim}
                  value={val}
                  label={
                    isZh
                      ? DIMENSION_LABELS[dim]?.zh || dim
                      : DIMENSION_LABELS[dim]?.en || dim
                  }
                />
              ))}
            </div>

            {/* One-liner */}
            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
              {stock.one_liner}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
