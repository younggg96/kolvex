// Shared by the stock page's chart card and the full-screen chart: the latest quote
// (the Web's lib/chart/quote.ts latestChartQuote) and the saved AI analysis versions.
import { useEffect, useState } from "react";
import { apiRequest } from "./http";
import type { AiTechnicalAnalysis, ChartVersion } from "./technicalTypes";

export type ChartQuote = {
  current_price: number | null;
  change_percent: number | null;
  previous_close?: number | null;
  market_time?: number | null;
  pre_market_price?: number | null;
  pre_market_time?: number | null;
  post_market_price?: number | null;
  post_market_time?: number | null;
  overnight_market_price?: number | null;
  overnight_market_time?: number | null;
  overnight_market_source?: string | null;
  overnight_market_delay_minutes?: number | null;
  source?: string | null;
  exchange_timezone_name?: string | null;
};

const sessionLabels = {
  regular: "常规交易 · 较昨收",
  pre: "盘前 · 较收盘",
  post: "盘后 · 较收盘",
  overnight: "夜盘 · 较收盘",
} as const;

const shortSessionLabels = {
  pre: "盘前",
  post: "盘后",
  overnight: "夜盘",
} as const;

export const positive = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/** An extended-hours price only when it is provably newer than the regular quote. */
export function latestQuote(
  quote: ChartQuote | undefined,
  includeExtended = true,
) {
  if (!quote || !positive(quote.current_price)) return null;
  let price = quote.current_price;
  let time = positive(quote.market_time) ? quote.market_time : undefined;
  let session: keyof typeof sessionLabels = "regular";
  if (time && includeExtended)
    for (const c of [
      {
        price: quote.pre_market_price,
        time: quote.pre_market_time,
        session: "pre" as const,
      },
      {
        price: quote.post_market_price,
        time: quote.post_market_time,
        session: "post" as const,
      },
      {
        price: quote.overnight_market_price,
        time: quote.overnight_market_time,
        session: "overnight" as const,
      },
    ])
      if (positive(c.price) && positive(c.time) && c.time > time) {
        price = c.price;
        time = c.time;
        session = c.session;
      }
  const baseline =
    session === "regular" ? quote.previous_close : quote.current_price;
  const changePercent =
    session === "regular" && Number.isFinite(quote.change_percent)
      ? quote.change_percent
      : positive(baseline)
        ? ((price - baseline) / baseline) * 100
        : null;
  return {
    price,
    time,
    session,
    changePercent,
    delayMinutes:
      session === "overnight" ? quote.overnight_market_delay_minutes : null,
  };
}

export function quoteSessionLabel(
  quote: NonNullable<ReturnType<typeof latestQuote>>,
  withBaseline = false,
) {
  if (quote.session === "overnight" && quote.delayMinutes === 15) {
    return withBaseline
      ? "夜盘 · 延迟 15 分钟 · 较收盘"
      : "夜盘 · 延迟 15 分钟";
  }
  return withBaseline || quote.session === "regular"
    ? sessionLabels[quote.session]
    : shortSessionLabels[quote.session];
}

export function withChartQuote(
  points: { date: string; close: number }[],
  quote: ReturnType<typeof latestQuote>,
) {
  const last = points.at(-1);
  if (!quote?.time || !last) return points;
  const time = new Date(quote.time * 1000);
  if (!(time.getTime() > Date.parse(last.date))) return points;
  return [...points, { date: time.toISOString(), close: quote.price }];
}

/** The current saved technical analysis and AI drawings, as the Web loads them on open. */
export function useSavedChartAnalysis(
  symbol: string,
  user: string | undefined,
) {
  const [analysis, setAnalysis] = useState<AiTechnicalAnalysis | null>(null);
  const [drawings, setDrawings] = useState<AiTechnicalAnalysis | null>(null);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    for (const kind of ["technical", "drawings"] as const)
      apiRequest<{ current: ChartVersion | null }>(
        `/market/analysis-history/${symbol}?kind=${kind}&limit=1&offset=0`,
        { signal: controller.signal, authenticated: true, expectedUser: user },
      )
        .then((data) => {
          const current = data.current;
          if (!current) return;
          const payload = { ...current.payload, version_id: current.id };
          if (kind === "technical") setAnalysis(payload);
          else setDrawings(payload);
        })
        .catch(() => {});
    return () => controller.abort();
  }, [symbol, user]);
  return { analysis, setAnalysis, drawings, setDrawings };
}
