"use client";

import { useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { signedPercent } from "@/lib/format";
import { getStockHistory } from "@/lib/stockApi";
import { cn } from "@/lib/utils";
import {
  XHS_DAYS_PATH,
  XhsNotFound,
  countsTotal,
  dailyChanges,
  dominantStance,
  isIsoDate,
  marketWindow,
  negativeCount,
  neighbours,
  readXhsDay,
  readXhsDays,
  stanceLabel,
  xhsDayPath,
  type XhsDaySummary,
  type XhsStance,
} from "@/lib/xhsSentiment";
import XhsDayView, { STANCE_TEXT, formatPtDate } from "./XhsDayView";

const CACHE = { ttl: 60_000, maxAge: 10 * 60_000, timeout: 20_000 };

/** CSS variable → resolved RGB string for Recharts (which needs concrete colours). */
function cssVar(name: string): string {
  if (typeof document === "undefined")
    return name === "--negative" ? "rgb(255,80,0)" : "rgb(155,160,166)";
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return "currentColor";
  // The CSS tokens are stored as "R G B" space-separated triples.
  const parts = raw.split(/\s+/);
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) return `rgb(${parts.join(",")})`;
  return raw;
}

interface TrendPoint {
  date: string;
  label: string;
  negative: number;
  bullish: number;
  total: number;
  /** The stance most posts took that day (as on the day's card); null when two tie. */
  stance: XhsStance | null;
  /** Index close-to-close % change that day; null when the market was closed or data is missing. */
  spy: number | null;
  qqq: number | null;
}

const MARKET_SYMBOLS = ["SPY", "QQQ"] as const;
type MarketChanges = Record<(typeof MARKET_SYMBOLS)[number], Record<string, number>>;

async function loadMarketChanges(start: string, end: string, signal: AbortSignal) {
  const [spy, qqq] = await Promise.all(
    MARKET_SYMBOLS.map((symbol) => getStockHistory(symbol, { interval: "1d", start, end }, signal)),
  );
  return { SPY: dailyChanges(spy), QQQ: dailyChanges(qqq) } satisfies MarketChanges;
}

function TrendTooltip({
  active,
  payload,
  c,
  lang,
  marketState,
}: TooltipProps<number, string> & {
  c: (en: string, zh: string) => string;
  lang: "en" | "zh";
  marketState: "loading" | "error" | "ready" | "hidden";
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TrendPoint;
  return (
    // Opaque card surface: the chart lines must not show through the tooltip.
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{d.label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {c("Most posts", "多数帖子")}{" "}
        <span className={cn("text-sm font-semibold", d.stance && STANCE_TEXT[d.stance])}>
          {d.stance ? stanceLabel(d.stance, lang) : c("No single lean", "没有单一倾向")}
        </span>
      </p>
      <p className="mt-1 tabular-nums text-negative">
        {c("Fear + Bearish", "恐慌 + 看空")} {d.negative}%
      </p>
      <p className="tabular-nums text-positive">
        {c("Bullish", "看多")} {d.bullish}%
      </p>
      <p className="text-xs text-muted-foreground">{c(`${d.total} posts`, `共 ${d.total} 条`)}</p>
      {marketState !== "hidden" && (
        <div className="mt-1.5 space-y-0.5 border-t border-border pt-1.5 tabular-nums">
          {(["spy", "qqq"] as const).map((key) => (
            <p key={key} className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground">{key.toUpperCase()}</span>
              <span
                className={cn(
                  "font-semibold",
                  marketState === "ready" && d[key] !== null
                    ? (d[key] as number) > 0
                      ? "text-positive"
                      : (d[key] as number) < 0
                        ? "text-negative"
                        : undefined
                    : "font-normal text-muted-foreground",
                )}
              >
                {marketState === "loading"
                  ? "…"
                  : marketState === "error"
                    ? c("Unavailable", "暂不可用")
                    : d[key] === null
                      ? c("Market closed", "休市")
                      : signedPercent(d[key])}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Recent days as an inline chart (no Card wrapper — rendered inside the combined sentiment section). */
export function TrendChart({
  days,
  selected,
  onSelect,
}: {
  days: XhsDaySummary[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  const c = useCopy();
  const { locale } = useTranslation();
  const lang = locale === "zh" ? "zh" : "en";

  const marketRange = useMemo(() => marketWindow(days.map((day) => day.date_pt)), [days]);
  const market = useCachedResource(
    marketRange ? `xhs-market:${marketRange.start}:${marketRange.end}` : "xhs-market:none",
    (signal) =>
      marketRange
        ? loadMarketChanges(marketRange.start, marketRange.end, signal)
        : Promise.reject(new Error()),
    { ttl: 5 * 60_000, maxAge: 30 * 60_000, timeout: 20_000, enabled: Boolean(marketRange) },
  );
  const marketState: "loading" | "error" | "ready" = market.data
    ? "ready"
    : market.error
      ? "error"
      : "loading";

  const data = useMemo(() => {
    return [...days].reverse().map((day): TrendPoint => {
      const counts = day.sentiment.all;
      const total = countsTotal(counts);
      const neg = total ? Math.round((negativeCount(counts) / total) * 100) : 0;
      const bull = total ? Math.round((counts.bullish / total) * 100) : 0;
      return {
        date: day.date_pt,
        label: formatPtDate(day.date_pt, lang),
        negative: neg,
        bullish: bull,
        total,
        stance: dominantStance(counts),
        spy: market.data?.SPY[day.date_pt] ?? null,
        qqq: market.data?.QQQ[day.date_pt] ?? null,
      };
    });
  }, [days, lang, market.data]);
  const showStrip = marketState !== "error";
  // Symmetric axis around 0 so up and down days read at the same scale; at least ±1%.
  const marketMax = useMemo(() => {
    const values = data.flatMap((point) => [point.spy, point.qqq]).filter((v) => v !== null);
    return Math.max(1, Math.ceil(Math.max(0, ...values.map((v) => Math.abs(v as number)))));
  }, [data]);

  const negColor = useMemo(() => cssVar("--negative"), []);
  const posColor = useMemo(() => cssVar("--positive"), []);
  const mutedColor = useMemo(() => cssVar("--muted-foreground"), []);

  const handleClick = useCallback(
    (state: { activePayload?: { payload: TrendPoint }[] } | null) => {
      const point = state?.activePayload?.[0]?.payload;
      if (point) onSelect(point.date);
    },
    [onSelect],
  );

  if (days.length < 2) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-negative-fill" />
          {c("Fear + Bearish %", "恐慌 + 看空 %")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-positive-fill" />
          {c("Bullish %", "看多 %")}
        </span>
      </div>

      {/* Sentiment chart; with the market strip below it, the date axis moves to the strip. */}
      <div className="mt-3 h-44 w-full md:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            onClick={handleClick}
            style={{ cursor: "pointer" }}
            margin={CHART_MARGIN}
            syncId="xhs-trend"
          >
            <defs>
              <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={negColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={negColor} stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={posColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={posColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={mutedColor} strokeOpacity={0.15} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: mutedColor }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              scale="point"
              padding={X_PADDING}
              hide={showStrip}
            />
            <YAxis
              yAxisId="sentiment"
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: mutedColor }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={<TrendTooltip c={c} lang={lang} marketState={marketState} />} />
            <Area
              yAxisId="sentiment"
              type="monotone"
              dataKey="negative"
              name={c("Fear + Bearish", "恐慌 + 看空")}
              stroke={negColor}
              strokeWidth={2}
              fill="url(#negGrad)"
              dot={(props: Record<string, unknown>) => {
                const { cx, cy, payload } = props as {
                  cx: number;
                  cy: number;
                  payload: TrendPoint;
                };
                const isActive = payload.date === selected;
                return (
                  <circle
                    key={payload.date}
                    cx={cx}
                    cy={cy}
                    r={isActive ? 5 : 3}
                    fill={negColor}
                    stroke={isActive ? "rgb(var(--background))" : "none"}
                    strokeWidth={isActive ? 2 : 0}
                  />
                );
              }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "rgb(var(--background))" }}
            />
            <Area
              yAxisId="sentiment"
              type="monotone"
              dataKey="bullish"
              name={c("Bullish", "看多")}
              stroke={posColor}
              strokeWidth={2}
              fill="url(#posGrad)"
              dot={(props: Record<string, unknown>) => {
                const { cx, cy, payload } = props as {
                  cx: number;
                  cy: number;
                  payload: TrendPoint;
                };
                const isActive = payload.date === selected;
                return (
                  <circle
                    key={`b-${payload.date}`}
                    cx={cx}
                    cy={cy}
                    r={isActive ? 5 : 3}
                    fill={posColor}
                    stroke={isActive ? "rgb(var(--background))" : "none"}
                    strokeWidth={isActive ? 2 : 0}
                  />
                );
              }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "rgb(var(--background))" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Market strip: SPY / QQQ close-to-close move per day, on the same dates as the chart. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-medium">{c("SPY / QQQ daily move", "SPY / QQQ 当日涨跌")}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-foreground/80" aria-hidden />
          SPY
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-foreground/35" aria-hidden />
          {c("QQQ (lighter)", "QQQ（浅色）")}
        </span>
        <span className="text-muted-foreground">
          {c("Green up, red down; weekends closed", "绿涨红跌，周末休市")}
        </span>
      </div>
      {marketState === "error" ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {c("SPY / QQQ moves are unavailable right now.", "SPY / QQQ 涨跌暂不可用。")}
        </p>
      ) : marketState === "loading" ? (
        <Skeleton className="mt-2 h-24 w-full rounded-lg md:h-28" />
      ) : (
        <div className="mt-1 h-28 w-full md:h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              onClick={handleClick}
              style={{ cursor: "pointer" }}
              margin={{ ...CHART_MARGIN, top: 16, bottom: 0 }}
              syncId="xhs-trend"
              barGap={2}
              barCategoryGap="30%"
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: mutedColor }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                scale="point"
                padding={X_PADDING}
              />
              <YAxis
                domain={[-marketMax, marketMax]}
                ticks={[-marketMax, 0, marketMax]}
                tickFormatter={(v: number) => (v > 0 ? `+${v}%` : `${v}%`)}
                tick={{ fontSize: 11, fill: mutedColor }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <ReferenceLine y={0} stroke={mutedColor} strokeOpacity={0.4} />
              {/* Hover highlights the day here; the synced chart above shows the one tooltip. */}
              <Tooltip cursor={{ fill: "rgb(var(--foreground) / 0.06)" }} content={() => null} />
              {(["spy", "qqq"] as const).map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key.toUpperCase()}
                  barSize={12}
                  radius={2}
                  isAnimationActive={false}
                >
                  {data.map((point) => {
                    const value = point[key];
                    return (
                      <Cell
                        key={point.date}
                        fill={value !== null && value < 0 ? negColor : posColor}
                        fillOpacity={key === "spy" ? 0.9 : 0.4}
                      />
                    );
                  })}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const CHART_MARGIN = { top: 4, right: 4, bottom: 0, left: 0 };
// Both charts use a point scale with the same padding so each day's dot sits over its bars.
const X_PADDING = { left: 28, right: 28 };

function DayLoading() {
  const c = useCopy();
  return (
    <ContentLoading label={c("Loading the digest", "正在加载情绪日报")}>
      <Card className="space-y-4 p-5">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </ContentLoading>
  );
}

function Retry({
  message,
  onRetry,
  busy,
}: {
  message: string;
  onRetry: () => void;
  busy: boolean;
}) {
  const c = useCopy();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm"
    >
      <p>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={busy}>
        {c("Retry", "重试")}
      </Button>
    </div>
  );
}

export default function XhsSentimentPage() {
  const c = useCopy();
  const { locale } = useTranslation();
  const lang = locale === "zh" ? "zh" : "en";
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const requested = search.get("date");

  const days = useCachedResource(XHS_DAYS_PATH, readXhsDays, CACHE);
  const list = days.data ?? [];
  const selected = isIsoDate(requested) ? requested : list[0]?.date_pt;
  const day = useCachedResource(
    selected ? xhsDayPath(selected) : "xhs:none",
    selected ? readXhsDay(selected) : async () => null,
    { ...CACHE, enabled: Boolean(selected) },
  );
  const { older, newer } = selected ? neighbours(list, selected) : { older: null, newer: null };
  const busy = days.loading || days.refreshing || day.loading || day.refreshing;

  const select = (date: string | null) => {
    if (!date) return;
    const next = new URLSearchParams(search.toString());
    if (date === list[0]?.date_pt) next.delete("date");
    else next.set("date", date);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const refresh = () => {
    days.refresh();
    day.refresh();
  };

  let body: React.ReactNode;
  if (days.loading && !days.data) body = <DayLoading />;
  else if (days.error && !days.data)
    body = (
      <Retry
        message={c("Could not load the digest.", "暂时无法加载小红书情绪。")}
        onRetry={refresh}
        busy={busy}
      />
    );
  else if (!selected)
    body = (
      <p role="status" className="py-16 text-center text-sm text-muted-foreground">
        {c("No digest has been imported yet.", "还没有导入任何一天的情绪日报。")}
      </p>
    );
  else if (day.error instanceof XhsNotFound)
    body = (
      <div role="status" className="py-16 text-center text-sm text-muted-foreground">
        <p>{c("No digest for this date.", "这一天没有情绪日报。")}</p>
        {list[0] && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => select(list[0].date_pt)}
          >
            {c("Show the latest day", "查看最新一天")}
          </Button>
        )}
      </div>
    );
  else if (day.error && !day.data)
    body = (
      <Retry
        message={c("Could not load this day.", "暂时无法加载这一天的内容。")}
        onRetry={day.refresh}
        busy={busy}
      />
    );
  else if (!day.data) body = <DayLoading />;
  else
    body = (
      <XhsDayView
        day={day.data}
        trendSlot={
          list.length >= 2 && selected ? (
            <TrendChart days={list} selected={selected} onSelect={select} />
          ) : undefined
        }
      />
    );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[100rem] space-y-5 px-[16px] pb-8 pt-[12px] md:px-8 md:py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:text-[2rem]">
            {c("Xiaohongshu sentiment", "小红书情绪")}
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => select(older)}
              disabled={!older}
              aria-label={c("Previous day", "前一天")}
              title={c("Previous day", "前一天")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <span className="min-w-[6.5rem] text-center text-sm font-medium tabular-nums">
              {selected ? formatPtDate(selected, lang) : "—"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => select(newer)}
              disabled={!newer}
              aria-label={c("Next day", "后一天")}
              title={c("Next day", "后一天")}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={refresh}
              disabled={busy}
              aria-label={c("Refresh", "刷新")}
              title={c("Refresh", "刷新")}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
        {Boolean(days.error) && days.data && (
          <p role="status" className="text-sm text-muted-foreground">
            {c("Could not refresh. Showing saved days.", "暂时无法刷新，正在显示上次读取的内容。")}
          </p>
        )}
        {body}
      </div>
    </div>
  );
}
