"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  LayoutPanelLeft,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import CompanyLogo from "@/components/ui/company-logo";
import WatchlistButton from "@/components/decision/WatchlistButton";
import { Change, money, useCopy } from "@/components/decision/shared";
import { useStockNews } from "@/components/decision/useStockNews";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useNewsTranslations } from "@/components/news/useNewsTranslations";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { withSign } from "@/lib/format";
import { marketStockHref } from "@/lib/stockLinks";
import {
  earningsRows,
  finite,
  fundamentalsKey,
  loadFundamentals,
  type EarningsData,
} from "@/lib/stockFundamentals";
import {
  DEFAULT_SIDE_PANELS,
  SIDE_PANEL_IDS,
  moveSidePanel,
  readSidePanelLayout,
  toggleSidePanel,
  toggleSidePanelCollapsed,
  visibleSidePanels,
  writeSidePanelLayout,
  type SidePanelId,
  type SidePanelLayout,
} from "@/lib/chart/sidePanels";
import { cn } from "@/lib/utils";

type Copy = (en: string, zh: string) => string;

const panelTitle = (id: SidePanelId, c: Copy) =>
  id === "watchlist"
    ? c("Watchlist", "自选")
    : id === "ai"
      ? c("AI analysis", "AI 分析")
      : id === "news"
        ? c("News", "新闻")
        : c("Earnings", "财报");

/**
 * The advanced chart's right column: a stack of panels next to the K-line. The watchlist leads
 * and picks the charted symbol; AI, news and earnings follow the charted symbol.
 */
export default function AdvancedSidePanels({
  symbol,
  ai,
  onSelectSymbol,
}: {
  symbol: string;
  /** The chart's AI actions and results; null when this chart offers no AI. */
  ai: ReactNode | null;
  onSelectSymbol?: (symbol: string) => void;
}) {
  const c = useCopy();
  const [layout, setLayout] = useState<SidePanelLayout>(DEFAULT_SIDE_PANELS);
  useEffect(() => setLayout(readSidePanelLayout()), []);
  const update = (next: SidePanelLayout) => {
    setLayout(next);
    writeSidePanelLayout(next);
  };
  const available = SIDE_PANEL_IDS.filter((id) => id !== "ai" || ai !== null);
  const open = visibleSidePanels(layout, available);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-end pb-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="gap-1.5">
              <LayoutPanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {c("Panels", "面板")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-1.5">
            <ul aria-label={c("Panels", "面板")}>
              {available.map((id) => {
                const shown = open.includes(id);
                const index = layout.open.indexOf(id);
                const title = panelTitle(id, c);
                return (
                  <li key={id} className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={shown}
                      onClick={() => update(toggleSidePanel(layout, id))}
                      className="flex min-h-10 flex-1 items-center gap-2.5 rounded-full px-2 text-left text-sm transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border border-border text-[0.625rem]",
                          shown && "border-primary bg-primary text-primary-foreground",
                        )}
                        aria-hidden="true"
                      >
                        {shown ? "✓" : ""}
                      </span>
                      {title}
                    </button>
                    {shown && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index <= 0}
                          aria-label={c(`Move ${title} up`, `上移${title}`)}
                          onClick={() => update(moveSidePanel(layout, id, -1))}
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index < 0 || index >= layout.open.length - 1}
                          aria-label={c(`Move ${title} down`, `下移${title}`)}
                          onClick={() => update(moveSidePanel(layout, id, 1))}
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
        {open.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {c("Pick a panel from Panels.", "从「面板」里选择要显示的内容。")}
          </p>
        )}
        {open.map((id) => (
          <SidePanel
            key={id}
            title={panelTitle(id, c)}
            collapsed={layout.collapsed.includes(id)}
            grow={id !== "earnings"}
            action={id === "watchlist" ? <WatchlistButton ticker={symbol} /> : null}
            onToggle={() => update(toggleSidePanelCollapsed(layout, id))}
            onClose={() => update(toggleSidePanel(layout, id))}
          >
            {id === "watchlist" ? (
              <WatchlistPanel symbol={symbol} onSelectSymbol={onSelectSymbol} />
            ) : id === "ai" ? (
              ai
            ) : id === "news" ? (
              <NewsPanel key={symbol} symbol={symbol} />
            ) : (
              <EarningsPanel symbol={symbol} />
            )}
          </SidePanel>
        ))}
      </div>
    </div>
  );
}

function SidePanel({
  title,
  collapsed,
  grow,
  action,
  onToggle,
  onClose,
  children,
}: {
  title: string;
  collapsed: boolean;
  grow: boolean;
  action: ReactNode;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useCopy();
  const bodyId = useId();
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border border-border",
        !collapsed && "min-h-[14rem]",
        !collapsed && grow && "flex-1 basis-0",
        collapsed && "shrink-0",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 px-2 py-1",
          !collapsed && "border-b border-border",
        )}
      >
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-full px-1.5 text-left text-sm font-semibold focus-visible:outline-none"
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", collapsed && "-rotate-90")}
            aria-hidden="true"
          />
          <span className="truncate">{title}</span>
        </button>
        {action}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={c(`Close ${title}`, `关闭${title}`)}
          title={c(`Close ${title}`, `关闭${title}`)}
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
      <div
        id={bodyId}
        hidden={collapsed}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
      >
        {children}
      </div>
    </section>
  );
}

function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full rounded-md" />
      ))}
    </div>
  );
}

function WatchlistPanel({
  symbol,
  onSelectSymbol,
}: {
  symbol: string;
  onSelectSymbol?: (symbol: string) => void;
}) {
  const c = useCopy();
  const { watchlist, ready, userId, error, refresh } = useWatchlist();
  const { quotes, loading } = useMarketQuotes(watchlist, ready && !!userId);

  if (!ready)
    return (
      <div role="status">
        <span className="sr-only">{c("Loading Watchlist", "正在加载自选股")}</span>
        <RowsSkeleton />
      </div>
    );
  if (!userId || error === "auth")
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center text-sm">
        <p className="text-muted-foreground">
          {c("Sign in to see your Watchlist.", "登录后查看自选股。")}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/auth">{c("Sign in", "登录")}</Link>
        </Button>
      </div>
    );
  if (error && !watchlist.length)
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center text-sm">
        <p className="text-muted-foreground">
          {c("Watchlist could not be loaded.", "自选股暂时无法加载。")}
        </p>
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          {c("Retry", "重试")}
        </Button>
      </div>
    );
  if (!watchlist.length)
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center text-sm">
        <p className="text-muted-foreground">
          {c("No stocks in your Watchlist yet.", "还没有自选股。")}
        </p>
        <WatchlistButton ticker={symbol} showLabel />
      </div>
    );

  return (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">{c("Watchlist", "自选股")}</caption>
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="pb-1 text-left font-normal">
            {c("Symbol", "代码")}
          </th>
          <th scope="col" className="w-24 pb-1 text-right font-normal">
            {c("Price", "价格")}
          </th>
          <th scope="col" className="w-20 pb-1 text-right font-normal">
            {c("Change", "涨跌幅")}
          </th>
        </tr>
      </thead>
      <tbody>
        {watchlist.map((item) => {
          const quote = quotes[item];
          const active = item === symbol;
          const select = () => onSelectSymbol?.(item);
          return (
            <tr
              key={item}
              aria-current={active ? "true" : undefined}
              className={cn(
                "cursor-pointer transition-colors hover:bg-foreground/[0.05]",
                active && "bg-secondary",
              )}
              onClick={select}
            >
              <th scope="row" className="rounded-l-lg py-1.5 pl-1 text-left font-normal">
                {onSelectSymbol ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      select();
                    }}
                    aria-label={c(`Chart ${item}`, `在图表中查看 ${item}`)}
                    className="flex min-w-0 items-center gap-2 rounded focus-visible:outline-none"
                  >
                    <CompanyLogo symbol={item} size="sm" />
                    <span className="truncate font-semibold">{item}</span>
                  </button>
                ) : (
                  <Link href={marketStockHref(item)} className="flex min-w-0 items-center gap-2">
                    <CompanyLogo symbol={item} size="sm" />
                    <span className="truncate font-semibold">{item}</span>
                  </Link>
                )}
              </th>
              <td className="py-1.5 text-right tabular-nums">
                {loading && !quote ? (
                  <Skeleton className="ml-auto h-4 w-14 rounded" />
                ) : (
                  money(quote?.price)
                )}
              </td>
              <td className="rounded-r-lg py-1.5 pr-1 text-right">
                {loading && !quote ? (
                  <Skeleton className="ml-auto h-4 w-12 rounded" />
                ) : (
                  <Change value={quote?.changePercent} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function NewsPanel({ symbol }: { symbol: string }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const news = useStockNews(symbol);
  const visible = news.articles.slice(0, 20);
  const translation = useNewsTranslations(
    visible.map((item) => ({ ...item, id: item.uuid || item.link, symbols: [symbol] })),
    locale,
  );
  const intlLocale = locale === "zh" ? "zh-CN" : "en-US";

  if (news.loading && !news.articles.length)
    return (
      <div role="status">
        <span className="sr-only">{c("Loading stock news", "正在加载个股新闻")}</span>
        <RowsSkeleton />
      </div>
    );
  return (
    <>
      {news.error && (
        <div role="alert" className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
          <span className="flex-1">
            {news.articles.length
              ? c("Update failed. Showing the last news.", "更新失败，已保留上次获取的新闻。")
              : c("News could not be loaded.", "新闻暂时无法加载。")}
          </span>
          <Button size="sm" variant="ghost" onClick={news.refresh} disabled={news.loading}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {c("Retry", "重试")}
          </Button>
        </div>
      )}
      {!news.error && !news.articles.length && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {c(`No recent news for ${symbol}.`, `${symbol} 暂无最新新闻。`)}
        </p>
      )}
      <ul className="divide-y divide-border">
        {visible.map((item) => {
          const published = item.publish_time ? new Date(item.publish_time * 1000) : null;
          const validDate = published && Number.isFinite(published.getTime()) ? published : null;
          const title = translation.translations[item.title] || item.title;
          return (
            <li key={item.link} className="py-2">
              <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{item.publisher || c("News source", "新闻来源")}</span>
                {validDate && (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={validDate.toISOString()} className="shrink-0">
                      {validDate.toLocaleString(intlLocale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </>
                )}
              </div>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                lang={translation.translations[item.title] ? "zh-CN" : "en"}
                className="line-clamp-3 text-sm font-medium leading-5 underline-offset-4 hover:underline focus-visible:outline-none"
              >
                {title}
                <ExternalLink aria-hidden className="ml-1 inline h-3 w-3 text-muted-foreground" />
                <span className="sr-only">
                  {c(" (original source, new tab)", "（原文，新标签页）")}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function EarningsPanel({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const key = fundamentalsKey(symbol, "earnings");
  const resource = useCachedResource(key, (signal) => loadFundamentals<EarningsData>(key, signal), {
    ttl: 300_000,
  });
  if (resource.loading && !resource.data)
    return (
      <div role="status">
        <span className="sr-only">{c("Loading earnings", "正在加载财报")}</span>
        <RowsSkeleton rows={4} />
      </div>
    );
  if (resource.error && !resource.data)
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center text-sm">
        <p className="text-muted-foreground">
          {c("Earnings could not be loaded.", "财报数据暂时无法加载。")}
        </p>
        <Button size="sm" variant="outline" onClick={resource.refresh}>
          {c("Retry", "重试")}
        </Button>
      </div>
    );
  const rows = resource.data ? earningsRows(resource.data) : [];
  // The source's date is kept for upcoming rows, never guessed.
  const upcoming = rows.find((row) => Date.parse(row.period) > Date.now() && !finite(row.actual));
  const reported = rows
    .filter((row) => finite(row.actual))
    .reverse()
    .slice(0, 8);
  const eps = (value: number | null) => (finite(value) ? value.toFixed(2) : "—");

  if (!upcoming && !reported.length)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {c("No earnings data from the source.", "数据源暂无财报数据。")}
      </p>
    );
  return (
    <div className="space-y-2">
      {upcoming && (
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{c("Next report", "下次财报")}</span>
          <span className="font-semibold tabular-nums">
            {f.date(upcoming.period)}
            {finite(upcoming.estimate) && (
              <span className="ml-2 font-normal text-muted-foreground">
                {c("Est. EPS", "预期 EPS")} {eps(upcoming.estimate)}
              </span>
            )}
          </span>
        </p>
      )}
      {reported.length > 0 && (
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">{c("Reported EPS", "已公布 EPS")}</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="pb-1 text-left font-normal">
                {c("Date", "日期")}
              </th>
              <th scope="col" className="pb-1 text-right font-normal">
                {c("Est.", "预期")}
              </th>
              <th scope="col" className="pb-1 text-right font-normal">
                {c("Actual", "实际")}
              </th>
              <th scope="col" className="pb-1 text-right font-normal">
                {c("Surprise", "超预期")}
              </th>
            </tr>
          </thead>
          <tbody>
            {reported.map((row) => (
              <tr key={row.period} className="border-t border-border">
                <th scope="row" className="py-1.5 text-left font-normal">
                  {f.date(row.period)}
                </th>
                <td className="py-1.5 text-right text-muted-foreground">{eps(row.estimate)}</td>
                <td className="py-1.5 text-right font-semibold">{eps(row.actual)}</td>
                <td
                  className={cn(
                    "py-1.5 text-right",
                    finite(row.surprise) &&
                      (row.surprise > 0
                        ? "text-positive"
                        : row.surprise < 0
                          ? "text-negative"
                          : "text-muted-foreground"),
                  )}
                >
                  {finite(row.surprise)
                    ? withSign(row.surprise, (magnitude) => `${magnitude.toFixed(2)}%`, {
                        digits: 2,
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-muted-foreground">
        {c("EPS source: Yahoo Finance", "EPS 来源：Yahoo Finance")}
      </p>
    </div>
  );
}
