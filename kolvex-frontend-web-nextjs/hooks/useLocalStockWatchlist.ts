"use client";

import { useEffect, useState } from "react";

const key = "kolvex:stock-watchlist:v1";
const event = "kolvex:stock-watchlist-changed";
function read(): string[] {
  const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
  return Array.isArray(value) ? Array.from(new Set(value.filter((item): item is string =>
    typeof item === "string" && /^[A-Z0-9.\-^=]{1,20}$/.test(item)))) : [];
}

/** Explicitly device-local; no account or cross-device persistence implied. */
export function useLocalStockWatchlist() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const sync = () => {
      try { setTickers(read()); setReady(true); setError(false); }
      catch { setReady(false); setError(true); }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(event, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(event, sync); };
  }, []);
  const toggle = (ticker: string) => {
    try {
      const current = read();
      const next = current.includes(ticker) ? current.filter(item => item !== ticker) : [...current, ticker];
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(event));
    } catch { setError(true); }
  };
  return { tickers, ready, error, toggle };
}
