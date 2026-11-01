import Link from "next/link";
import { Clock, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CompanyLogo from "@/components/ui/company-logo";
import { DecisionBadge } from "./badges";
import type { TradingAnalysis } from "@/lib/tradingAnalysisApi";
import { marketStockHref } from "@/lib/stockLinks";

/** One report-card presentation for the workspace and anonymous library. */
export function ResearchSummaryCard({ analysis, href, t, headingLevel = "h3" }: {
  headingLevel?: "h2" | "h3" | "h4";
  analysis: TradingAnalysis;
  href: string;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const Heading = headingLevel;
  return (
    <div className="relative flex h-full min-w-0 flex-col gap-6 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.04]">
      {/* Report overlay: the card body opens the report; the ticker identity is a
          sibling link so it can reach that stock's quotes page. */}
      <Link href={href} className="absolute inset-0 rounded-3xl focus-visible:outline-none " aria-label={analysis.ticker}><span className="sr-only">{analysis.ticker} {t("tradingAnalysis.title")}</span></Link>
      <div className="relative flex min-w-0 items-center gap-3">
        <Link
          href={marketStockHref(analysis.ticker)}
          className="relative z-10 flex min-w-0 flex-1 items-center gap-3 rounded-2xl underline-offset-4 hover:underline focus-visible:outline-none "
          aria-label={t("redditOpinions.openStock", { ticker: analysis.ticker })}
        >
          <CompanyLogo symbol={analysis.ticker} size="md" />
          <Heading className="min-w-0 break-words text-lg font-semibold text-foreground">
            {analysis.ticker}<span className="sr-only"> {t("tradingAnalysis.title")}</span>
          </Heading>
        </Link>
        <span className="relative z-10 shrink-0"><DecisionBadge decision={analysis.final_decision} t={t} /></span>
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
    </div>
  );
}
