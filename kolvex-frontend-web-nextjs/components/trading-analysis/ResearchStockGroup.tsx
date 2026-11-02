import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import { DecisionBadge } from "./badges";
import type { TradingAnalysis } from "@/lib/tradingAnalysisApi";
import { marketStockHref } from "@/lib/stockLinks";

type Props = {
  ticker: string;
  tasks: TradingAnalysis[];
  page: number;
  locale: string;
  t: (key: string, params?: Record<string, string>) => string;
};

export function ResearchStockGroup({ ticker, tasks, page, locale, t }: Props) {
  const latest = tasks[0];
  const date = (value: string) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(locale, {
      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    }).format(parsed);
  };
  return (
    <details className="group border-b border-border">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-3 py-5 transition-colors hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4 [&::-webkit-details-marker]:hidden">
        <CompanyLogo symbol={ticker} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-semibold">{ticker}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("tradingAnalysis.explore.taskCount", { count: String(tasks.length) })}<time dateTime={latest.trade_date} className="mt-1 block sm:hidden">{date(latest.trade_date)}</time></p>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="text-right">
            <span className="mb-1.5 block text-xs text-muted-foreground">{t("tradingAnalysis.explore.latestDecision")}</span>
            {latest.final_decision ? <DecisionBadge decision={latest.final_decision} t={t} /> : <span className="text-sm text-muted-foreground">{t("tradingAnalysis.explore.noDecision")}</span>}
          </div>
          <time dateTime={latest.trade_date} className="figure hidden text-sm text-muted-foreground sm:block">{date(latest.trade_date)}</time>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </div>
      </summary>
      <div className="pb-4 sm:pl-16">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground sm:px-4">
          <h4 className="font-medium">{t("tradingAnalysis.explore.taskHistory")} · {t("tradingAnalysis.explore.newestFirst")}</h4>
          <Link href={marketStockHref(ticker)} className="rounded-md py-1 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("redditOpinions.openStock", { ticker })}</Link>
        </div>
        <ul className="divide-y divide-border">
          {tasks.map((task, index) => (
            <li key={task.id}>
              <Link href={`/dashboard/trading-analysis/explore/${task.id}${page > 1 ? `?page=${page}` : ""}`} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-3 py-4 transition-colors hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:px-4">
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <time dateTime={task.trade_date} className="figure">{date(task.trade_date)}</time>
                    {index === 0 && <span className="text-xs font-normal text-muted-foreground">{t("tradingAnalysis.explore.latestTask")}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="break-all">{task.author?.full_name || task.author?.username || t("research.author")}</span>
                    {task.llm_provider && <span className="capitalize">{task.llm_provider}</span>}
                    {task.duration_seconds != null && <span>{t("tradingAnalysis.durationSeconds", { seconds: String(Math.round(task.duration_seconds)) })}</span>}
                    <span className="figure">#{task.id.slice(0, 8)}</span>
                  </div>
                </div>
                <DecisionBadge decision={task.final_decision} t={t} />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{t("tradingAnalysis.explore.readTask")}<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
