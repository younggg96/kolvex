"use client";

import { useEffect, useMemo, useState } from "react";
import { CORE_STOCKS } from "@/lib/stockDiscovery";
import type { StockOverview } from "@/lib/stockApi";

/** Sector keys used for grouping; extends the discovery filter keys with Yahoo's two extra sectors. */
export type SectorKey = (typeof CORE_STOCKS)[number]["sector"] | "materials" | "real_estate" | "crypto" | "other";

const STORAGE_KEY = "kolvex:stock-sectors:v1";
const TTL = 30 * 24 * 60 * 60 * 1000;
const core = new Map<string, SectorKey>(CORE_STOCKS.map(stock => [stock.symbol, stock.sector]));

/** Yahoo Finance sector names → our grouping keys. */
const YAHOO_SECTORS: Record<string, SectorKey> = {
  "technology": "technology",
  "communication services": "communication",
  "consumer cyclical": "consumer",
  "consumer defensive": "consumer",
  "financial services": "financials",
  "healthcare": "healthcare",
  "energy": "energy",
  "industrials": "industrials",
  "utilities": "utilities",
  "basic materials": "materials",
  "real estate": "real_estate",
};

type Stored = Record<string, { sector: SectorKey; at: number }>;
function readStored(): Stored {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Stored; } catch { return {}; }
}
function writeStored(next: Stored) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
}

const inflight = new Map<string, Promise<SectorKey | undefined>>();
function fetchSector(symbol: string): Promise<SectorKey | undefined> {
  let pending = inflight.get(symbol);
  if (!pending) {
    pending = fetch(`/api/stocks?action=overview&symbol=${encodeURIComponent(symbol)}`)
      .then(response => response.ok ? response.json() as Promise<StockOverview> : undefined)
      .then(data => {
        const name = data?.company?.sector?.trim().toLowerCase();
        // A missing sector (ETFs, funds) is a real answer, not a failure.
        return data ? (name && YAHOO_SECTORS[name]) || "other" : undefined;
      })
      .catch(() => undefined)
      .finally(() => inflight.delete(symbol));
    inflight.set(symbol, pending);
  }
  return pending;
}

function known(symbol: string, stored: Stored): SectorKey | undefined {
  if (symbol.endsWith("-USD")) return "crypto";
  const fixed = core.get(symbol);
  if (fixed) return fixed;
  const entry = stored[symbol];
  return entry && Date.now() - entry.at < TTL ? entry.sector : undefined;
}

/** Resolve each symbol's sector: core list first, then a long-lived browser cache, then the company profile. */
export function useStockSectors(symbols: readonly string[]) {
  const key = symbols.join(",");
  const [sectors, setSectors] = useState<Record<string, SectorKey>>({});

  useEffect(() => {
    const list = key ? key.split(",") : [];
    const stored = readStored();
    const initial: Record<string, SectorKey> = {};
    const missing: string[] = [];
    for (const symbol of list) {
      const sector = known(symbol, stored);
      if (sector) initial[symbol] = sector; else missing.push(symbol);
    }
    setSectors(initial);
    if (!missing.length) return;
    let active = true;
    Promise.all(missing.map(async symbol => [symbol, await fetchSector(symbol)] as const)).then(results => {
      const resolved = results.filter((entry): entry is readonly [string, SectorKey] => entry[1] !== undefined);
      if (!resolved.length) return;
      const latest = readStored();
      for (const [symbol, sector] of resolved) latest[symbol] = { sector, at: Date.now() };
      writeStored(latest);
      if (active) setSectors(previous => ({ ...previous, ...Object.fromEntries(resolved) }));
    });
    return () => { active = false; };
  }, [key]);

  return useMemo(() => ({
    sectors,
    resolved: symbols.every(symbol => symbol in sectors),
  }), [sectors, symbols]);
}
