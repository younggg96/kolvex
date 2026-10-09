"use client";
import { useEffect, useState } from "react";
import { getStockQuote, type StockQuote } from "@/lib/stockApi";
import { getYouTubeStockDetail } from "@/lib/youtubeOpinionsApi";
import {
  creatorEvidence,
  thesisChanges,
  type Thesis,
  type Direction,
} from "@/lib/decision";
import { cn } from "@/lib/utils";
import { Change, DirectionBadge, PriceLadder, WorkspaceLink, money, useCopy } from "./shared";

export type ThesisSource = { quote: StockQuote | null; creators: Direction | null };
export type ThesisChange = ReturnType<typeof thesisChanges>[number];

/** Evaluate on page load; missing sources never become a healthy signal. */
export function useThesisSignals(theses: Thesis[]) {
  const [data, setData] = useState<Record<string, ThesisSource>>({});
  const tickersKey = [
    ...new Set(theses.filter((t) => t.status === "active").map((t) => t.ticker)),
  ]
    .sort()
    .join(",");
  useEffect(() => {
    let alive = true;
    setData({});
    const tickers = tickersKey ? tickersKey.split(",") : [];
    async function load() {
      for (let offset = 0; offset < tickers.length; offset += 6) {
        if (!alive) return;
        const batch = await Promise.all(
          tickers.slice(offset, offset + 6).map(async (ticker) => {
            const [quote, opinions] = await Promise.allSettled([
              getStockQuote(ticker),
              getYouTubeStockDetail(ticker),
            ]);
            return [
              ticker,
              {
                quote: quote.status === "fulfilled" && quote.value.price > 0 ? quote.value : null,
                creators:
                  opinions.status === "fulfilled"
                    ? creatorEvidence(opinions.value.opinions).direction
                    : null,
              },
            ] as const;
          }),
        );
        if (alive) setData((previous) => ({ ...previous, ...Object.fromEntries(batch) }));
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [tickersKey]);
  const changesFor = (thesis: Thesis) => {
    const source = data[thesis.ticker];
    return thesisChanges(thesis, source?.quote?.price ?? null, { creators: source?.creators });
  };
  const pending = tickersKey
    ? tickersKey.split(",").filter((ticker) => !data[ticker]).length
    : 0;
  return { data, changesFor, checking: pending > 0 };
}

export function useChangeLabels() {
  const c = useCopy();
  return {
    invalidation: c("Invalidation reached", "触及失效价"),
    target: c("Target reached", "触及目标价"),
    creators: c("Creator view changed", "博主倾向改变"),
    technical: c("Technical view changed", "技术倾向改变"),
  } satisfies Record<ThesisChange, string>;
}

export default function ThesisWatch({
  theses,
  showLogos = true,
  signals,
  heldTickers = [],
}: {
  theses: Thesis[];
  showLogos?: boolean;
  signals?: ReturnType<typeof useThesisSignals>;
  heldTickers?: string[];
}) {
  const c = useCopy();
  const own = useThesisSignals(signals ? [] : theses);
  const { data, changesFor } = signals ?? own;
  const labels = useChangeLabels();
  return (
    <ul className="divide-y divide-border">
      {theses.map((thesis) => {
        const source = data[thesis.ticker];
        const changes = changesFor(thesis);
        return (
          <li
            key={thesis.thesis_id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-2 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,240px)_auto]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <WorkspaceLink
                  ticker={thesis.ticker}
                  showLogo={showLogos}
                  held={heldTickers.includes(thesis.ticker)}
                />
                <DirectionBadge direction={thesis.direction} />
              </div>
              <p className="mt-1.5 line-clamp-1 max-w-xl text-[13px] text-muted-foreground">
                {thesis.reasoning}
              </p>
            </div>
            <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-1 md:col-start-2">
              <PriceLadder
                compact
                direction={thesis.direction}
                invalidation={thesis.invalidation}
                entryLow={thesis.entry_low}
                entryHigh={thesis.entry_high}
                target={thesis.target}
                price={source?.quote?.price}
              />
            </div>
            <div className="text-right text-[13px]">
              <p className="font-semibold tabular-nums">
                {money(source?.quote?.price)}{" "}
                <Change value={source?.quote?.changePercent} className="text-xs font-medium" />
              </p>
              <p
                className={cn(
                  "mt-1 text-xs",
                  changes.length ? "font-semibold text-warning" : "text-muted-foreground",
                )}
              >
                {thesis.status === "closed"
                  ? c("Closed", "已结束")
                  : changes.length
                    ? changes.map((key) => labels[key]).join(c(", ", "，"))
                    : !source
                      ? c("Checking…", "检查中…")
                      : !source.quote
                        ? c("Price unavailable", "价格暂不可用")
                        : c("Within plan", "仍在计划内")}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
