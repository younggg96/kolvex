"use client";

/**
 * Data the search page shares between its discovery sections and its results:
 * superinvestors (13F managers), congress trades, the latest options-activity run
 * and person updates. Each source loads once and is cached under the same key the
 * feature's own page uses, so opening that page afterwards is instant.
 */

import { useEffect, useState } from "react";
import { INVESTOR_PROFILES } from "@/components/superinvestors/shared";
import { useCachedResource } from "@/hooks/useCachedResource";
import { INSTITUTIONS_KEY, type InstitutionManager } from "@/lib/freeResearch";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import { runKey, type ActivityRun, type ActivityTicker } from "@/lib/optionsActivity";
import type { PersonUpdate } from "@/lib/personUpdates";
import { loadFundamentals } from "@/lib/stockFundamentals";

export type Resource<T> = { data?: T; loading: boolean; error: unknown; refresh: () => void };

export type CongressTrade = {
  id: number;
  member_name: string;
  chamber: "house" | "senate" | null;
  ticker: string | null;
  asset_name: string | null;
  trade_date: string;
  filed_date: string;
  direction: "buy" | "sell" | "exchange" | "other";
  transaction_type: string;
  amount_range: string | null;
  source_url: string | null;
};
type CongressPage = { trades: CongressTrade[]; has_more: boolean; synced: boolean };

export const congressTradesHref = (filter: { ticker?: string | null; member?: string }) => {
  const params = new URLSearchParams();
  if (filter.ticker) params.set("ticker", filter.ticker);
  else if (filter.member) params.set("member", filter.member);
  const query = params.toString();
  return `/dashboard/congress-trades${query ? `?${query}` : ""}`;
};
export const OPTIONS_ACTIVITY_HREF = "/dashboard/options-activity";
export const personUpdatesHref = (person: string) =>
  `/dashboard/person-updates?${new URLSearchParams({ person })}`;

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok)
    throw Object.assign(new Error(`${url} unavailable`), { status: response.status });
  return response.json();
}

export function useSuperinvestorManagers(): Resource<{ managers: InstitutionManager[] }> {
  return useCachedResource(
    INSTITUTIONS_KEY,
    (signal) => loadFundamentals<{ managers: InstitutionManager[] }>(INSTITUTIONS_KEY, signal),
    { ttl: 600_000, timeout: 50_000, enabled: isProductFeatureEnabled("superinvestors") },
  );
}

export function usePersonUpdates(): Resource<{ items: PersonUpdate[] }> {
  return useCachedResource(
    "/api/person-updates",
    (signal) => fetchJson<{ items: PersonUpdate[] }>("/api/person-updates", signal),
    { ttl: 60_000, timeout: 20_000, enabled: isProductFeatureEnabled("personUpdates") },
  );
}

export function useLatestOptionsRun(): Resource<ActivityRun> {
  return useCachedResource(runKey(null), (signal) => fetchJson<ActivityRun>(runKey(null), signal), {
    ttl: 60_000,
    timeout: 25_000,
    enabled: isProductFeatureEnabled("optionsActivity"),
  });
}

export function useLatestCongressTrades(limit: number): Resource<CongressPage> {
  const url = `/api/congress/trades?page=1&limit=${limit}`;
  return useCachedResource(url, (signal) => fetchJson<CongressPage>(url, signal), {
    ttl: 60_000,
    enabled: isProductFeatureEnabled("congressTrades"),
  });
}

/** Largest net premium first, either direction. */
export function optionsTickersByPremium(run: ActivityRun | undefined): ActivityTicker[] {
  return [...(run?.payload.tickers ?? [])].sort(
    (a, b) => Math.abs(b.net_premium) - Math.abs(a.net_premium),
  );
}

/** Every name a manager is known by: firm, Chinese firm name and the investor behind it. */
export function managerNames(manager: InstitutionManager): string[] {
  const profile = manager.profile ?? INVESTOR_PROFILES[manager.id];
  return [manager.name, manager.id, profile?.zhName, profile?.person.en, profile?.person.zh].filter(
    (name): name is string => Boolean(name),
  );
}

export function matchesPersonUpdate(item: PersonUpdate, query: string) {
  return (
    [item.person, item.person_cn, item.title].some((text) => text?.toLowerCase().includes(query)) ||
    item.tickers.some((ticker) => ticker.toLowerCase() === query) ||
    item.tags.some((tag) => tag.toLowerCase() === query)
  );
}

/**
 * Congress trades for the query: by member name, and by ticker when the query is a stock.
 * The server filters, so this waits for typing to settle and only runs for signed-in users.
 */
export function useCongressSearch(
  query: string,
  ticker: string | undefined,
  { enabled, delay }: { enabled: boolean; delay: number },
) {
  const [state, setState] = useState<{
    key: string;
    trades: CongressTrade[];
    failed?: boolean;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${query}|${ticker ?? ""}`;
  const active = enabled && query.length >= 2 && isProductFeatureEnabled("congressTrades");

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const urls = [
        `/api/congress/trades?${new URLSearchParams({ member: query, limit: "20" })}`,
        ...(ticker ? [`/api/congress/trades?${new URLSearchParams({ ticker, limit: "5" })}`] : []),
      ];
      Promise.allSettled(urls.map((url) => fetchJson<CongressPage>(url, controller.signal))).then(
        (results) => {
          if (controller.signal.aborted) return;
          const trades = new Map<number, CongressTrade>();
          for (const result of results)
            if (result.status === "fulfilled")
              for (const trade of result.value.trades) trades.set(trade.id, trade);
          setState({
            key,
            trades: [...trades.values()],
            failed: results.every((result) => result.status === "rejected"),
          });
        },
      );
    }, delay);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, key, query, ticker, delay, attempt]);

  const current = active && state?.key === key ? state : null;
  return {
    trades: current?.trades ?? [],
    pending: active && !current,
    failed: Boolean(current?.failed),
    retry: () => {
      setState(null);
      setAttempt((value) => value + 1);
    },
  };
}
