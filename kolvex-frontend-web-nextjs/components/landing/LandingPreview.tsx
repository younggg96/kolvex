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
  { ticker: "NVDA", name: "NVIDIA", nameZh: "英伟达", score: 72, creators: 9, opinions: 23 },
  { ticker: "TSLA", name: "Tesla", nameZh: "特斯拉", score: -38, creators: 7, opinions: 16 },
  { ticker: "MSFT", name: "Microsoft", nameZh: "微软", score: 45, creators: 6, opinions: 11 },
  { ticker: "AAPL", name: "Apple", nameZh: "苹果", score: 9, creators: 5, opinions: 9 },
];

const shifts = [
  { ticker: "AMD", change: 118, day: "today" },
  { ticker: "PLTR", change: -152, day: "yesterday" },
  { ticker: "GOOGL", change: 34, day: "earlier" },
] as const;

const dayLabels = {
  zh: { today: "今天", yesterday: "昨天", earlier: "3 天前" },
  en: { today: "Today", yesterday: "Yesterday", earlier: "3 days ago" },
};

export default function LandingPreview() {
  const { locale } = useTranslation();
  const zh = locale === "zh";

  return (
    <div className="rh-product-preview landing-width relative z-10 pb-10">
      <div className="border-y border-border px-4 py-6 text-left md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">{zh ? "博主观点工作台" : "Creator opinion workspace"}</h2>
          <p className="text-xs text-muted-foreground">
            {zh ? `${summary.total_stocks} 只股票 · ${summary.total_creators} 位博主` : `${summary.total_stocks} stocks · ${summary.total_creators} creators`}
          </p>
        </div>

        <OpinionDistribution summary={summary} zh={zh} />

        <div className="mt-6 grid gap-x-10 gap-y-6 border-t border-border pt-6 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="min-w-0">
            <h3 className="text-sm font-semibold">{zh ? "按股票浏览" : "Browse by stock"}</h3>
            <div className="mt-1">
              {stocks.map((stock) => (
                <div key={stock.ticker} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo symbol={stock.ticker} name={stock.name} size="md" />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{stock.ticker}</p>
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{zh ? stock.nameZh : stock.name}</p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
                    <OpinionStrength value={stock.score} />
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {zh ? `${stock.creators} 位博主，${stock.opinions} 条观点` : `${stock.creators} creators, ${stock.opinions} opinions`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0">
            <h3 className="text-sm font-semibold">{zh ? "最近观点变化" : "Recent shifts"}</h3>
            <ul className="mt-1">
              {shifts.map((shift) => (
                <li key={shift.ticker} className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm last:border-0">
                  <span className="min-w-0">
                    <span className="block font-semibold">{shift.ticker}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{dayLabels[zh ? "zh" : "en"][shift.day]}</span>
                  </span>
                  <OpinionStrength value={shift.change} change />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{zh ? "界面示例，观点数据仅用于演示。" : "Interface preview with illustrative opinion data."}</p>
    </div>
  );
}
