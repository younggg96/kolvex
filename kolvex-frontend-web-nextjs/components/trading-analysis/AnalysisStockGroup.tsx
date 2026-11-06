import Link from "next/link";
import { ChevronDown } from "lucide-react";
import SetupTradeLink from "@/components/paper-trading/SetupTradeLink";
import CompanyLogo, { phoneListLogoClass } from "@/components/ui/company-logo";
import { marketStockHref } from "@/lib/stockLinks";
import { formatPrice } from "@/lib/stockApi";
import { cn } from "@/lib/utils";
import type { AnalysisIndexItem } from "@/lib/stockAnalysisHistory";
import { planGridClass, researchGridClass, researchSummaryClass } from "./researchList";

type Props = {
  item: AnalysisIndexItem;
  mode: "technical" | "planned";
  locale: string;
  t: (key: string, params?: Record<string, string>) => string;
};

const PLAN = "youtubeOpinions.ai.tradePlan";

function Chevron() {
  return <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />;
}

function StockLink({ ticker, t, className }: { ticker: string; t: Props["t"]; className?: string }) {
  return <Link href={marketStockHref(ticker)} className={cn("inline-flex min-h-11 items-center rounded-md text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", className)}>{t("redditOpinions.openStock", { ticker })}</Link>;
}

export function AnalysisStockGroup({ item, mode, locale, t }: Props) {
  const date = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(item.created_at));
  const dateTime = <time dateTime={item.created_at}>{date}</time>;
  const biasTone = item.bias === "bullish" ? "text-positive" : item.bias === "bearish" ? "text-negative" : "text-foreground";
  const bias = item.bias ? <span className={cn("whitespace-nowrap text-sm font-semibold", biasTone)}>{t(`youtubeOpinions.ai.bias.${item.bias}`)}</span> : null;
  const setup = mode === "planned" ? item.setup : null;

  if (setup) {
    const entry = `${formatPrice(setup.entry_low)} – ${formatPrice(setup.entry_high)}`;
    const stop = formatPrice(setup.invalidation);
    const targets = setup.targets.map(formatPrice).join(" / ");
    const ratio = `${setup.risk_reward.toFixed(2)} : 1`;
    const cell = "figure text-sm tabular-nums";
    return (
      <li>
        <details className="group">
          <summary className={cn(researchSummaryClass, planGridClass)}>
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo symbol={item.ticker} size="md" className={phoneListLogoClass} />
              <div className="min-w-0">
                <h3 className="text-[0.9375rem] font-semibold">{item.ticker}</h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{setup.name}</p>
              </div>
            </div>
            <div className="hidden sm:block">{bias}</div>
            <div className={cn(cell, "hidden min-[1400px]:block")}><span className="sr-only">{t(`${PLAN}.entry`)} </span>{entry}</div>
            <div className={cn(cell, "hidden text-right min-[1400px]:block")}><span className="sr-only">{t(`${PLAN}.stop`)} </span>{stop}</div>
            <div className={cn(cell, "hidden text-right min-[1400px]:block")}><span className="sr-only">{t(`${PLAN}.target`)} </span>{targets}</div>
            <div className="text-right">
              <div className="figure text-[0.9375rem] font-semibold tabular-nums"><span className="sr-only">{t(`${PLAN}.ratio`)} </span>{ratio}</div>
              <div className="mt-0.5 sm:hidden">{bias}</div>
            </div>
            <div className="figure hidden text-right text-sm text-muted-foreground sm:block">{dateTime}</div>
            <Chevron />
          </summary>
          <div className="px-2 pb-5 pt-1 sm:pl-[3.75rem] sm:pr-10">
            <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 min-[1400px]:hidden">
              {[["entry", entry], ["stop", stop], ["target", targets]].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t(`${PLAN}.${label}`)}</dt>
                  <dd className="figure mt-1 break-words text-sm font-medium tabular-nums">{value}</dd>
                </div>
              ))}
              <div className="sm:hidden">
                <dt className="text-xs text-muted-foreground">{t("tradingAnalysis.explore.colDate")}</dt>
                <dd className="figure mt-1 text-sm font-medium">{dateTime}</dd>
              </div>
            </dl>
            <h4 className="text-xs text-muted-foreground">{t("youtubeOpinions.ai.planReason")}</h4>
            <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-7">{setup.reason}</p>
            <div className="flex flex-wrap items-center gap-x-4">
              <SetupTradeLink symbol={item.ticker} setup={setup} />
              <StockLink ticker={item.ticker} t={t} className="mt-4" />
            </div>
          </div>
        </details>
      </li>
    );
  }

  return (
    <li>
      <details className="group">
        <summary className={cn(researchSummaryClass, researchGridClass)}>
          <div className="flex min-w-0 items-center gap-3">
            <CompanyLogo symbol={item.ticker} size="md" className={phoneListLogoClass} />
            <div className="min-w-0">
              <h3 className="text-[0.9375rem] font-semibold">{item.ticker}</h3>
              {item.summary && <p className="mt-0.5 hidden truncate text-xs text-muted-foreground group-open:!hidden sm:block">{item.summary}</p>}
              <p className="figure mt-0.5 text-xs text-muted-foreground sm:hidden">{dateTime}</p>
            </div>
          </div>
          <div className="text-right sm:text-left">{bias}</div>
          <div className="figure hidden text-right text-sm text-muted-foreground sm:block">{dateTime}</div>
          <Chevron />
        </summary>
        <div className="px-2 pb-5 pt-1 sm:pl-[3.75rem] sm:pr-10">
          {item.summary && <p className="whitespace-pre-line break-words text-sm leading-7">{item.summary}</p>}
          {item.signals.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs text-muted-foreground">{t("youtubeOpinions.ai.signals")}</h4>
              <ul className="mt-1.5 max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6">
                {item.signals.map((signal, index) => <li key={index}>{signal}</li>)}
              </ul>
            </div>
          )}
          <StockLink ticker={item.ticker} t={t} className="mt-2" />
        </div>
      </details>
    </li>
  );
}
