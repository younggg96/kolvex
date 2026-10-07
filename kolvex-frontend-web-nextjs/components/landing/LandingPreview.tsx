"use client";

import CompanyLogo from "@/components/ui/company-logo";
import OpinionDistribution from "@/components/youtube/OpinionDistribution";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import { useTranslation } from "@/lib/i18n";
import type { YouTubeOpinionSummary } from "@/lib/youtubeOpinionsApi";

/**
 * Hero preview of the opinion workspace, built from the components the product
 * itself renders so it stays in step with the real interface.
 */

const summary: YouTubeOpinionSummary = {
  total_opinions: 59,
  total_stocks: 14,
  total_creators: 11,
  bullish_count: 31,
  bearish_count: 17,
  neutral_count: 8,
  avg_score: 24,
};

const stocks = [
  { ticker: "NVDA", name: "NVIDIA", score: 72, creators: 9, opinions: 23 },
  { ticker: "TSLA", name: "Tesla", score: -38, creators: 7, opinions: 16 },
  { ticker: "MSFT", name: "Microsoft", score: 45, creators: 6, opinions: 11 },
  { ticker: "AAPL", name: "Apple", score: 9, creators: 5, opinions: 9 },
];

const shifts = [
  { ticker: "AMD", change: 118, day: "today" },
  { ticker: "PLTR", change: -152, day: "yesterday" },
  { ticker: "GOOGL", change: 34, day: "earlier" },
] as const;

export default function LandingPreview() {
  const { t } = useTranslation();

  return (
    <div className="rh-product-preview landing-width relative z-10 pb-10">
      <div className="border-y border-border px-4 py-6 text-left md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">{t("landing.workspace.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("landing.workspace.summary", {
              stocks: String(summary.total_stocks),
              creators: String(summary.total_creators),
            })}
          </p>
        </div>

        <OpinionDistribution summary={summary} />

        <div className="mt-6 grid gap-x-10 gap-y-6 border-t border-border pt-6 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="min-w-0">
            <h3 className="text-sm font-semibold">{t("landing.workspace.browseByStock")}</h3>
            <div className="mt-1">
              {stocks.map((stock) => (
                <div key={stock.ticker} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo symbol={stock.ticker} name={stock.name} size="md" />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{stock.ticker}</p>
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{t(`landing.workspace.names.${stock.ticker}`)}</p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
                    <OpinionStrength value={stock.score} />
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t("landing.workspace.coverage", {
                        creators: String(stock.creators),
                        opinions: String(stock.opinions),
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0">
            <h3 className="text-sm font-semibold">{t("landing.workspace.recentShifts")}</h3>
            <ul className="mt-1">
              {shifts.map((shift) => (
                <li key={shift.ticker} className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm last:border-0">
                  <span className="min-w-0">
                    <span className="block font-semibold">{shift.ticker}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{t(`landing.workspace.${shift.day}`)}</span>
                  </span>
                  <OpinionStrength value={shift.change} change />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("landing.workspace.disclaimer")}</p>
    </div>
  );
}
