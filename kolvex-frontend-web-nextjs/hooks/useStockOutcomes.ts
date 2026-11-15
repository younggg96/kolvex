"use client";

import { useCachedResource } from "@/hooks/useCachedResource";
import type { OpinionOutcome } from "@/lib/opinionOutcome";
import { getYouTubeStockOutcomes } from "@/lib/youtubeOpinionsApi";

/**
 * How the stock moved after each stored opinion on `ticker` (one request per ticker, shared
 * by every list on the page). A separate request from the opinions, so slow or failed prices
 * never hold the opinions back. `null` ticker: lists that mix stocks show no outcome.
 */
export function useStockOutcomes(ticker: string | null | undefined) {
  const symbol = ticker?.trim().toUpperCase() || "";
  const resource = useCachedResource(
    `/api/youtube-opinions/stocks/${encodeURIComponent(symbol)}/outcomes`,
    (signal) => getYouTubeStockOutcomes(symbol, signal),
    { ttl: 10 * 60_000, enabled: Boolean(symbol) },
  );
  const failed = Boolean(resource.error) && !resource.data;
  // Not matched on `ticker`: the API spells it the Yahoo way (BRK.B -> BRK-B). Opinion ids are
  // unique, so a previous stock's response can never label this stock's cards.
  const data = symbol ? resource.data : undefined;
  return {
    /** Props for `OpinionCard`; empty when the list is not about one stock. */
    cardProps(opinionId: string): {
      outcome?: OpinionOutcome | "unavailable";
      outcomeHorizons?: number[];
      outcomeBenchmark?: string;
    } {
      if (!symbol) return {};
      return {
        outcome: failed ? "unavailable" : data?.outcomes[opinionId],
        outcomeHorizons: data?.horizons,
        outcomeBenchmark: data?.benchmark,
      };
    },
  };
}
