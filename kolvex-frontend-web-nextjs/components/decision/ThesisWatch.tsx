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
import { DirectionBadge, WorkspaceLink, money, useCopy } from "./shared";

/** Evaluate on page load; missing sources never become a healthy signal. */
export default function ThesisWatch({ theses, showLogos = true }: { theses: Thesis[]; showLogos?: boolean }) {
  const c = useCopy();
  const [data, setData] = useState<
    Record<string, { quote: StockQuote | null; creators: Direction | null }>
  >({});
  const tickersKey = [
    ...new Set(
      theses.filter((t) => t.status === "active").map((t) => t.ticker),
    ),
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
                quote:
                  quote.status === "fulfilled" && quote.value.price > 0
                    ? quote.value
                    : null,
                creators:
                  opinions.status === "fulfilled"
                    ? creatorEvidence(opinions.value.opinions).direction
                    : null,
              },
            ] as const;
          }),
        );
        if (alive)
          setData((previous) => ({
            ...previous,
            ...Object.fromEntries(batch),
          }));
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [tickersKey]);
  const labels = {
    invalidation: c("Invalidation reached", "触及失效价"),
    target: c("Target reached", "触及目标价"),
    creators: c("Creator view changed", "创作者倾向改变"),
    technical: c("Technical view changed", "技术倾向改变"),
  };
  return (
    <div className="divide-y divide-border">
      {theses.map((thesis) => {
        const source = data[thesis.ticker];
        const changes = thesisChanges(thesis, source?.quote?.price ?? null, {
          creators: source?.creators,
        });
        return (
          <div
            key={thesis.thesis_id}
            className="flex flex-wrap items-center justify-between gap-4 py-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <WorkspaceLink ticker={thesis.ticker} showLogo={showLogos} />
                <DirectionBadge direction={thesis.direction} />
              </div>
              <p className="mt-2 max-w-xl truncate text-xs text-muted-foreground">
                {thesis.reasoning}
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="font-medium tabular-nums">
                {money(source?.quote?.price)} · {c("Target", "目标")}{" "}
                {money(thesis.target)}
              </p>
              <p
                className={`mt-2 ${changes.length ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
              >
                {thesis.status === "closed"
                  ? c("Closed", "已结束")
                  : changes.length
                    ? changes.map((key) => labels[key]).join(" · ")
                    : !source
                      ? c("Checking evidence…", "检查证据中…")
                      : !source.quote
                        ? c("Price unavailable", "价格暂不可用")
                        : c(
                            "No price threshold crossed at current quote",
                            "当前报价未越过价格阈值",
                          )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
