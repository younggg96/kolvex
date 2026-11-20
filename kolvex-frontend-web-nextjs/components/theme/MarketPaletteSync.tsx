"use client";

import { useEffect } from "react";

import { usRegularSessionOpen } from "@/lib/pollingSchedule";
import {
  MARKET_PALETTE_EVENT,
  MARKET_PALETTE_INDEX,
  MARKET_PALETTE_STORAGE_KEY,
  marketPalette,
  paintChosenPalettes,
  paintMarketPalette,
  readFollowMarket,
} from "@/lib/themePalettes";

const CHECK_MS = 60_000;
const FETCH_MS = 5 * 60_000;
/** A reading older than this is not trusted to colour the page. */
const STALE_MS = 15 * 60_000;

async function fetchIndexChange(): Promise<number | null> {
  try {
    const response = await fetch("/api/market/indices", { cache: "no-store" });
    if (!response.ok) return null;
    const indices: Array<{ symbol?: string; changePercent?: unknown }> = await response.json();
    const index = indices.find((item) => item.symbol === MARKET_PALETTE_INDEX);
    const change = index?.changePercent;
    return typeof change === "number" && Number.isFinite(change) ? change : null;
  } catch {
    return null;
  }
}

/**
 * While "follow the market" is on, colours the page by the S&P 500's move today:
 * green when up or flat, red when down, mono outside the regular session. With no
 * fresh quote it falls back to the user's own palette instead of guessing.
 */
export function MarketPaletteSync() {
  useEffect(() => {
    let lastFetch = 0;
    let lastReading: { change: number; at: number } | null = null;
    let running = false;

    const tick = async (force = false) => {
      if (running || !readFollowMarket()) return;
      if (!usRegularSessionOpen()) {
        paintMarketPalette("mono");
        return;
      }
      if (!force && document.hidden) return;
      const now = Date.now();
      if (force || now - lastFetch >= FETCH_MS) {
        running = true;
        lastFetch = now;
        const change = await fetchIndexChange();
        running = false;
        if (!readFollowMarket()) return;
        if (change !== null) lastReading = { change, at: Date.now() };
      }
      if (lastReading && Date.now() - lastReading.at < STALE_MS) {
        paintMarketPalette(marketPalette(true, lastReading.change));
      } else {
        paintChosenPalettes();
      }
    };

    const restart = () => {
      lastFetch = 0;
      lastReading = null;
      void tick(true);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === MARKET_PALETTE_STORAGE_KEY) {
        if (readFollowMarket()) restart();
        else paintChosenPalettes();
      }
    };
    const onVisible = () => {
      if (!document.hidden) void tick();
    };

    void tick(true);
    const timer = window.setInterval(() => void tick(), CHECK_MS);
    window.addEventListener(MARKET_PALETTE_EVENT, restart);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(MARKET_PALETTE_EVENT, restart);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
