"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { createWatchlistStore, EMPTY_WATCHLIST } from "@/lib/watchlistStore";

const store = createWatchlistStore(async (userId, method, body) => {
  const response = await fetch("/api/watchlist", {
    method, cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", "X-Watchlist-User": userId },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw Error(response.status === 401 ? "auth" : "sync");
  return response.json();
}, () => window.localStorage);
const add = (ticker: string) => store.setTicker(ticker, true);
const remove = (ticker: string) => store.setTicker(ticker, false);

let consumers = 0;
let stop: (() => void) | undefined;
function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(listener);
  if (++consumers === 1) {
    const client = createClient();
    let active = true, authRevision = 0;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      authRevision++;
      store.setIdentity(session?.user.id ?? null);
    });
    const initialRevision = authRevision;
    void client.auth.getSession().then(({ data: { session }, error }) => {
      if (active && authRevision === initialRevision) store.setIdentity(error ? null : session?.user.id ?? null);
    }).catch(() => { if (active && authRevision === initialRevision) store.setIdentity(null); });
    const refresh = () => { if (document.visibilityState === "visible") void store.refresh(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    stop = () => {
      active = false; subscription.unsubscribe(); window.clearInterval(interval);
      window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      store.setIdentity(null);
    };
  }
  return () => { unsubscribe(); if (--consumers === 0) { stop?.(); stop = undefined; } };
}
export function useWatchlist() {
  const snapshot = useSyncExternalStore(subscribe, store.getSnapshot, () => EMPTY_WATCHLIST);
  return { ...snapshot, canEdit: snapshot.ready && !!snapshot.userId && !snapshot.pending && !snapshot.error, toggle: store.toggle, add, remove, refresh: store.refresh };
}
