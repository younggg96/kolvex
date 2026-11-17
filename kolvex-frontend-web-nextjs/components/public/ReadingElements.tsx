"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { StrengthIndicator } from "@/components/youtube/StrengthIndicator";
import { ResearchSummaryCard } from "@/components/trading-analysis/ResearchSummaryCard";
import { DecisionBadge } from "@/components/trading-analysis/badges";
import {
  ListCard,
  ListRow,
  ListRows,
  listFeedRowClass,
  listRowTargetClass,
} from "@/components/ui/list-card";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import { publicPagePath, publicResearchPath, publicStockPath } from "@/lib/publicRoutes";
import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { marketStockHref, marketStockUrl } from "@/lib/stockLinks";
import { creatorSharePath, sourceVideoUrl } from "@/lib/creatorSharing";
import type { TradingAnalysis } from "@/lib/tradingAnalysisApi";
import type { YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import { cn } from "@/lib/utils";

export function ReadingText({ en, zh }: { en: string; zh: string }) {
  return useCopy()(en, zh);
}

export function ReadingBackButton({ href, en, zh }: { href: string; en: string; zh: string }) {
  return <HeaderBackButton href={href} label={useCopy()(en, zh)} />;
}

export function ReadingQuotesIcon({ ticker }: { ticker: string }) {
  const c = useCopy();
  return (
    <Link
      href={marketStockHref(ticker)}
      aria-label={c(`Open ${ticker} quotes`, `打开 ${ticker} 行情页`)}
      className="shrink-0 rounded-full transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none"
    >
      <CompanyLogo symbol={ticker} size="lg" />
    </Link>
  );
}

export function ReadingHeading({
  title,
  children,
  icon,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div data-reading-reveal className="mb-8 max-w-[72ch]">
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <h1 className="min-w-0 break-words text-[1.75rem] font-bold leading-tight tracking-[-0.025em] md:text-[2rem]">
          {title}
        </h1>
      </div>
      {children && (
        <p className="mt-2 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  );
}

export function ReadingSectionHeading({
  title,
  count,
  id,
}: {
  title: React.ReactNode;
  count?: number;
  id?: string;
}) {
  return (
    <h2
      data-reading-reveal
      id={id}
      className="mb-4 border-b border-border pb-3 text-[1.0625rem] font-semibold text-foreground"
    >
      {title}
      {count !== undefined && (
        <span className="figure ml-2 text-sm font-normal text-muted-foreground">{count}</span>
      )}
    </h2>
  );
}

export function ReadingDate({ value }: { value?: string | null }) {
  const c = useCopy();
  const { t } = useTranslation();
  const date = formatOpinionDate(value, t("common.intlLocale"));
  return date ? (
    <time dateTime={value ?? undefined} className="tabular-nums">
      {date}
    </time>
  ) : (
    <span>{c("Date unavailable", "日期未提供")}</span>
  );
}

/**
 * Quotes-page shortcut for a stock shown inside a reading list.
 *
 * Reading surfaces usually already have a link on the identity (the stock's
 * reading page). A link cannot be nested inside another link, so this is a
 * native `button` that routes to `/dashboard/market/<TICKER>` instead — it is
 * keyboard reachable, keeps a 44px touch target and renders nothing for
 * symbols that have no routable quotes page (e.g. indexes).
 *
 * It carries `role="link"` because it behaves like a link, not a toggle.
 */
export function StockQuotesLink({ symbol, label }: { symbol: string; label?: string }) {
  const c = useCopy();
  const text = label ?? c("Quotes", "行情");
  const router = useRouter();
  const href = marketStockUrl(symbol);
  if (!href) return null;
  return (
    <button
      type="button"
      role="link"
      onClick={() => router.push(href)}
      aria-label={`${symbol} ${text}`}
      className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-sm px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none "
    >
      {text}
    </button>
  );
}

export function ReadingPagination({
  page,
  total,
  size,
  path,
}: {
  page: number;
  total: number;
  size: number;
  path: string;
}) {
  const c = useCopy();
  const pages = Math.ceil(total / size);
  if (pages <= 1) return null;
  return (
    <nav
      aria-label={c("Pagination", "分页")}
      className="reading-pagination mt-6 flex flex-wrap items-center gap-3 text-sm"
    >
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link rel="prev" href={publicPagePath(path, page - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {c("Previous", "上一页")}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {c("Previous", "上一页")}
        </Button>
      )}
      <span aria-current="page" className="figure text-muted-foreground">
        {c(`Page ${page} of ${pages}`, `第 ${page} / ${pages} 页`)}
      </span>
      {page < pages ? (
        <Button asChild variant="outline" size="sm">
          <Link rel="next" href={publicPagePath(path, page + 1)}>
            {c("Next", "下一页")}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          {c("Next", "下一页")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </nav>
  );
}

export function ResearchList({
  items,
  layout = "grid",
}: {
  items: TradingAnalysis[];
  layout?: "grid" | "stack";
}) {
  const c = useCopy();
  const { t } = useTranslation();
  if (layout === "stack") {
    return (
      <ListCard className="mt-4">
        <ListRows aria-label={c("Published reports", "已发布研究")}>
          {items.map((report) => (
            <ListRow key={report.id} data-reading-reveal data-reading-item="row">
              <Link
                href={publicResearchPath(report.id)}
                className={cn("flex min-w-0 items-center gap-3", listRowTargetClass)}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <CompanyLogo symbol={report.ticker} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-semibold">
                      {report.ticker}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <ReadingDate value={report.trade_date} />
                      {report.llm_provider && (
                        <span className="capitalize">{report.llm_provider}</span>
                      )}
                    </span>
                  </span>
                </span>
                <span className="shrink-0">
                  <DecisionBadge decision={report.final_decision} t={t} />
                </span>
              </Link>
            </ListRow>
          ))}
        </ListRows>
      </ListCard>
    );
  }
  return (
    <ul
      aria-label={c("Published reports", "已发布研究")}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {items.map((report) => (
        <li key={report.id} data-reading-reveal data-reading-item="card" className="min-w-0">
          <ResearchSummaryCard
            analysis={report}
            href={publicResearchPath(report.id)}
            t={t}
            displayDate={
              formatOpinionDate(report.trade_date, t("common.intlLocale")) ||
              c("Date unavailable", "日期未提供")
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function OpinionList({ opinions }: { opinions: YouTubeOpinion[] }) {
  const c = useCopy();
  const { t } = useTranslation();
  return (
    <ListCard>
      <ListRows aria-label={c("Creator opinions", "博主观点")}>
        {opinions.map((opinion) => {
          const source = sourceVideoUrl(opinion);
          const name =
            opinion.channel_title || opinion.channel_handle || c("View creator", "查看博主");
          return (
            <li key={opinion.id} className={cn(listFeedRowClass, "min-w-0")}>
              <header className="flex min-w-0 items-start gap-3">
                <CreatorAvatar name={name} avatarUrl={opinion.channel_avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Link
                      href={creatorSharePath(opinion.channel_id)}
                      className="rounded-sm text-sm font-semibold hover:underline focus-visible:outline-none "
                    >
                      {name}
                    </Link>
                    <h3 className="inline-flex items-center gap-1.5">
                      <Link
                        href={publicStockPath(opinion.ticker)}
                        className="inline-flex items-center gap-2 rounded-sm text-[0.9375rem] font-semibold hover:underline focus-visible:outline-none "
                      >
                        <CompanyLogo symbol={opinion.ticker} size="sm" />
                        <span>{opinion.ticker}</span>
                      </Link>
                      <StockQuotesLink symbol={opinion.ticker} />
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      <ReadingDate value={opinion.opinion_date || opinion.video_published_at} />
                      {c(" (ET)", "（美东日期）")}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <StrengthIndicator value={opinion.direction_score} t={t} />
                    {opinion.sentiment === "mixed" && (
                      <span className="text-xs font-medium text-warning">{c("Mixed", "分歧")}</span>
                    )}
                  </div>
                </div>
              </header>
              {opinion.company_name && (
                <p className="mt-3 text-xs text-muted-foreground">{opinion.company_name}</p>
              )}
              <p className="mt-4 max-w-[72ch] whitespace-pre-wrap text-[0.9375rem] leading-7 text-foreground">
                {opinion.summary ||
                  opinion.thesis ||
                  opinion.key_points?.join("\n") ||
                  c("No written summary. See the source video.", "暂无文字摘要，请查看原视频。")}
              </p>
              {!!(opinion.key_points?.length || opinion.risks?.length) && (
                <div className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
                  {[
                    {
                      id: "reasons",
                      title: c("Reasons given", "观点依据"),
                      items: opinion.key_points,
                    },
                    {
                      id: "risks",
                      title: c("Risks mentioned", "提及的风险"),
                      items: opinion.risks,
                    },
                  ].map(
                    ({ id, title, items }) =>
                      !!items?.length && (
                        <details key={id} className="text-sm">
                          <summary className="cursor-pointer rounded-full px-1 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none">
                            {title}
                          </summary>
                          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">
                            {items.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </details>
                      ),
                  )}
                </div>
              )}
              {source && (
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex max-w-full items-start gap-2 rounded-full px-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-none"
                >
                  <PlayCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    {opinion.video_title || c("View source video", "查看原视频")}
                  </span>
                </a>
              )}
            </li>
          );
        })}
      </ListRows>
    </ListCard>
  );
}
