import Link from "next/link";
import { Clock, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CompanyLogo from "@/components/ui/company-logo";
import { DecisionBadge } from "./badges";
import type { TradingAnalysis } from "@/lib/tradingAnalysisApi";

/** One report-card presentation for the workspace and anonymous library. */
export function ResearchSummaryCard({ analysis, href, t, headingLevel = "h3" }: {
  headingLevel?: "h2" | "h3" | "h4";
  analysis: TradingAnalysis;
  href: string;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const Heading = headingLevel;
  return (
    <Link
      href={href}
      className="flex h-full min-w-0 flex-col gap-6 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/25 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex min-w-0 items-center gap-3">
        <CompanyLogo symbol={analysis.ticker} size="md" />
        <Heading className="min-w-0 flex-1 break-words text-lg font-semibold text-foreground">
          {analysis.ticker}<span className="sr-only"> {t("tradingAnalysis.title")}</span>
        </Heading>
        <span className="shrink-0"><DecisionBadge decision={analysis.final_decision} t={t} /></span>
      </div>
      <div className="mt-auto space-y-3 border-t border-border pt-4 text-xs text-muted-foreground">
        {analysis.author && (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar className="h-5 w-5 shrink-0">
              {analysis.author.avatar_url && <AvatarImage src={analysis.author.avatar_url} alt="" />}
              <AvatarFallback className="bg-muted text-[8px]"><User className="h-2.5 w-2.5" /></AvatarFallback>
            </Avatar>
            <span className="truncate">{analysis.author.full_name || analysis.author.username || t("research.author")}</span>
          </span>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <time dateTime={analysis.trade_date} className="figure">{analysis.trade_date}</time>
          {!!analysis.duration_seconds && <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{t("tradingAnalysis.durationSeconds", { seconds: String(Math.round(analysis.duration_seconds)) })}</span>}
          {analysis.llm_provider && <span className="capitalize">{analysis.llm_provider}</span>}
        </div>
      </div>
    </Link>
  );
}
