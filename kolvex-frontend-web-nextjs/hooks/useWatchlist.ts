"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createWatchlistStore, EMPTY_WATCHLIST, WATCHLIST_KEY } from "@/lib/watchlist";

const store = createWatchlistStore(() => window.localStorage);
const add = (ticker: string) => store.setTicker(ticker, true);
const remove = (ticker: string) => store.setTicker(ticker, false);
function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(listener);
  const sync = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && (event.key === WATCHLIST_KEY || event.key === null)) store.sync(event.key === null ? null : event.newValue);
  };
  window.addEventListener("storage", sync);
  return () => { unsubscribe(); window.removeEventListener("storage", sync); };
}
export function useWatchlist() {
  const snapshot = useSyncExternalStore(subscribe, store.getSnapshot, () => EMPTY_WATCHLIST);
  useEffect(() => { store.hydrate(); }, []);
  return { ...snapshot, toggle: store.toggle, add, remove };
}
