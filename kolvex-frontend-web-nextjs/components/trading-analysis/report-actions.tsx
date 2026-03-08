"use client";

import { useState, useCallback } from "react";
import { Download, Copy, Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { TradingAnalysis } from "@/lib/tradingAnalysisApi";

function debateToMarkdown(
  debate: Record<string, string> | null | undefined,
  bullLabel: string,
  bearLabel: string,
  judgeLabel: string
): string {
  if (!debate) return "";
  const lines: string[] = [];
  for (const [key, value] of Object.entries(debate)) {
    if (!value) continue;
    let label = key;
    if (key.includes("bull") || key.includes("aggressive")) label = bullLabel;
    else if (key.includes("bear") || key.includes("conservative")) label = bearLabel;
    else if (key.includes("judge")) label = judgeLabel;
    lines.push(`### ${label}\n\n${value}\n`);
  }
  return lines.join("\n");
}

export function buildFullReport(
  analysis: TradingAnalysis,
  labels: {
    market: string;
    sentiment: string;
    news: string;
    fundamentals: string;
    investmentDebate: string;
    investmentPlan: string;
    traderPlan: string;
    riskDebate: string;
    finalSignal: string;
    bullResearcher: string;
    bearResearcher: string;
    aggressiveAnalyst: string;
    conservativeAnalyst: string;
    judgeDecision: string;
  }
): string {
  const sections: string[] = [
    `# ${analysis.ticker} — ${analysis.trade_date}\n`,
  ];

  if (analysis.final_decision) {
    sections.push(`**Decision: ${analysis.final_decision}**\n`);
  }

  const reports: [string | null | undefined, string][] = [
    [analysis.market_report, labels.market],
    [analysis.sentiment_report, labels.sentiment],
    [analysis.news_report, labels.news],
    [analysis.fundamentals_report, labels.fundamentals],
  ];

  for (const [content, label] of reports) {
    if (content) sections.push(`## ${label}\n\n${content}\n`);
  }

  if (analysis.investment_debate) {
    sections.push(
      `## ${labels.investmentDebate}\n\n${debateToMarkdown(
        analysis.investment_debate as Record<string, string>,
        labels.bullResearcher,
        labels.bearResearcher,
        labels.judgeDecision
      )}`
    );
  }

  if (analysis.investment_plan) {
    sections.push(`## ${labels.investmentPlan}\n\n${analysis.investment_plan}\n`);
  }

  if (analysis.trader_plan) {
    sections.push(`## ${labels.traderPlan}\n\n${analysis.trader_plan}\n`);
  }

  if (analysis.risk_debate) {
    sections.push(
      `## ${labels.riskDebate}\n\n${debateToMarkdown(
        analysis.risk_debate as Record<string, string>,
        labels.aggressiveAnalyst,
        labels.conservativeAnalyst,
        labels.judgeDecision
      )}`
    );
  }

  if (analysis.full_signal) {
    sections.push(`## ${labels.finalSignal}\n\n${analysis.full_signal}\n`);
  }

  return sections.join("\n");
}

export function FullReportActions({
  analysis,
  t,
}: {
  analysis: TradingAnalysis;
  t: (key: string) => string;
}) {
  const [copied, setCopied] = useState(false);

  const getLabels = useCallback(
    () => ({
      market: t("tradingAnalysis.tabs.market"),
      sentiment: t("tradingAnalysis.tabs.sentiment"),
      news: t("tradingAnalysis.tabs.news"),
      fundamentals: t("tradingAnalysis.tabs.fundamentals"),
      investmentDebate: t("tradingAnalysis.sections.investmentDebate"),
      investmentPlan: t("tradingAnalysis.sections.investmentPlan"),
      traderPlan: t("tradingAnalysis.sections.traderPlan"),
      riskDebate: t("tradingAnalysis.sections.riskDebate"),
      finalSignal: t("tradingAnalysis.sections.finalSignal"),
      bullResearcher: t("tradingAnalysis.debate.bullResearcher"),
      bearResearcher: t("tradingAnalysis.debate.bearResearcher"),
      aggressiveAnalyst: t("tradingAnalysis.debate.aggressiveAnalyst"),
      conservativeAnalyst: t("tradingAnalysis.debate.conservativeAnalyst"),
      judgeDecision: t("tradingAnalysis.debate.judgeDecision"),
    }),
    [t]
  );

  const getText = useCallback(
    () => buildFullReport(analysis, getLabels()),
    [analysis, getLabels]
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      toast.success(t("tradingAnalysis.fullReportCopied"));
      setTimeout(() => setCopied(false), 2000);
    });
  }, [getText, t]);

  const handleDownload = useCallback(() => {
    const text = getText();
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${analysis.ticker}_${analysis.trade_date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [getText, analysis.ticker, analysis.trade_date]);

  const handleShare = useCallback(async () => {
    const text = getText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${analysis.ticker} — ${analysis.trade_date}`,
          text,
        });
        return;
      } catch (e: any) {
        if (e.name === "AbortError") return;
      }
    }
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t("tradingAnalysis.fullReportCopied"));
    });
  }, [getText, analysis.ticker, analysis.trade_date, t]);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              onClick={handleCopy}
              className="gap-1.5"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {t("tradingAnalysis.debate.copyAll")}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{t("tradingAnalysis.debate.copyAll")}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              onClick={handleDownload}
              className="gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {t("tradingAnalysis.downloadFullReport")}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{t("tradingAnalysis.downloadFullReport")}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              onClick={handleShare}
              className="gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {t("tradingAnalysis.shareAnalysis")}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{t("tradingAnalysis.shareAnalysis")}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
