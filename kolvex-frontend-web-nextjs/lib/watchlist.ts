/** A shared browser-local list. The old Reddit list is imported once on first use. */
export const WATCHLIST_KEY = "kolvex:watchlist";
export const LEGACY_WATCHLIST_KEY = "kolvex:reddit-watchlist";

export function normalizeWatchlistTicker(value: string): string | null {
  const ticker = value.trim().replace(/^\$/, "").toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker) ? ticker : null;
}

export function parseWatchlist(raw: string | null): string[] {
  try {
    const values: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(values)) return [];
    return [...new Set(values.flatMap(value => {
      const ticker = typeof value === "string" ? normalizeWatchlistTicker(value) : null;
      return ticker ? [ticker] : [];
    }))];
  } catch { return []; }
}

export interface WatchlistSnapshot {
  watchlist: readonly string[];
  ready: boolean;
  storageUnavailable: boolean;
}
export const EMPTY_WATCHLIST: WatchlistSnapshot = { watchlist: [], ready: false, storageUnavailable: false };

/** Synchronous mutations avoid stale closures when several star controls are mounted. */
export function createWatchlistStore(storage: () => Pick<Storage, "getItem" | "setItem">) {
  let snapshot = EMPTY_WATCHLIST;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  function hydrate() {
    if (snapshot.ready) return;
    try {
      const target = storage();
      const saved = target.getItem(WATCHLIST_KEY);
      const watchlist = parseWatchlist(saved ?? target.getItem(LEGACY_WATCHLIST_KEY));
      snapshot = { watchlist, ready: true, storageUnavailable: false };
      if (saved === null) target.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch { snapshot = { ...snapshot, ready: true, storageUnavailable: true }; }
    emit();
  }
  function setTicker(value: string, saved: boolean) {
    hydrate();
    const ticker = normalizeWatchlistTicker(value);
    if (!ticker) return;
    // Re-read durable state before changing it so other tabs' edits are retained.
    let current = snapshot.watchlist;
    if (!snapshot.storageUnavailable) {
      try { current = parseWatchlist(storage().getItem(WATCHLIST_KEY)); } catch { /* Keep session state. */ }
    }
    const watchlist = saved ? [...new Set([...current, ticker])] : current.filter(item => item !== ticker);
    snapshot = { watchlist, ready: true, storageUnavailable: false };
    try { storage().setItem(WATCHLIST_KEY, JSON.stringify(watchlist)); }
    catch { snapshot = { ...snapshot, storageUnavailable: true }; }
    emit();
    return snapshot;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    hydrate,
    setTicker,
    toggle(value: string) {
      const ticker = normalizeWatchlistTicker(value);
      if (!ticker) return;
      hydrate();
      return setTicker(ticker, !snapshot.watchlist.includes(ticker));
    },
    sync(raw: string | null) {
      snapshot = { watchlist: parseWatchlist(raw), ready: true, storageUnavailable: false };
      emit();
    },
  };
}
