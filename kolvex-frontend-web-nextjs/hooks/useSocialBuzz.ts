"use client";

import { useMemo } from "react";
import { useCachedResource } from "@/hooks/useCachedResource";
import { parseRedditStocks, type RedditRanking } from "@/lib/redditOpinions";
import { parseXTickerRanking, type SocialBuzz, type XTickerRanking } from "@/lib/socialBuzz";

/** Reddit and X heat load independently so one failing source never hides the other. */
export function useSocialBuzz(enabled: boolean) {
  const reddit = useCachedResource<RedditRanking>("reddit:ranking:all-stocks", async signal => {
    const response = await fetch("/api/reddit-opinions?community=all-stocks", { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Reddit ranking unavailable");
    const ranking = await response.json();
    return { ...ranking, results: parseRedditStocks(ranking) };
  }, { ttl: 300_000, maxAge: 3_600_000, timeout: 20_000, enabled });
  const x = useCachedResource<XTickerRanking>("x:tickers:7d", async signal => {
    const response = await fetch("/api/x-content/tickers", { signal, cache: "no-store" });
    if (!response.ok) throw new Error("X ticker ranking unavailable");
    return parseXTickerRanking(await response.json());
  }, { ttl: 300_000, maxAge: 3_600_000, timeout: 20_000, enabled });
  const social = useMemo<SocialBuzz>(() => ({ reddit: reddit.data?.results, x: x.data?.tickers }), [reddit.data, x.data]);
  return {
    social,
    reddit, x,
    loading: (reddit.loading && !reddit.data) || (x.loading && !x.data),
    retry: () => { reddit.refresh(); x.refresh(); },
  };
}
