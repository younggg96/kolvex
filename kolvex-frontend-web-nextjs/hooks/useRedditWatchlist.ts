"use client";

import { useCallback, useEffect, useState } from "react";
import { parseRedditWatchlist, REDDIT_WATCHLIST_KEY } from "@/lib/redditOpinions";

/** Device-local preferences; unavailable storage still permits session-only use. */
export function useRedditWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  useEffect(() => {
    try {
      setWatchlist(parseRedditWatchlist(localStorage.getItem(REDDIT_WATCHLIST_KEY)));
    } catch {
      setStorageUnavailable(true);
    }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === REDDIT_WATCHLIST_KEY || event.key === null) {
        setWatchlist(parseRedditWatchlist(event.newValue));
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggle = useCallback((ticker: string) => {
    if (!ready) return;
    const next = watchlist.includes(ticker) ? watchlist.filter(value => value !== ticker) : [...watchlist, ticker];
    setWatchlist(next);
    try {
      localStorage.setItem(REDDIT_WATCHLIST_KEY, JSON.stringify(next));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }, [watchlist, ready]);

  return { watchlist, ready, toggle, storageUnavailable };
}
