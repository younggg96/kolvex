import { LEGACY_WATCHLIST_KEY, WATCHLIST_KEY, normalizeWatchlistTicker, parseWatchlist } from "./watchlist";

export type WatchlistError = "auth" | "load" | "save" | "migration" | null;
export interface WatchlistSnapshot {
  watchlist: readonly string[];
  ready: boolean;
  userId: string | null;
  pending: boolean;
  error: WatchlistError;
}
export const EMPTY_WATCHLIST: WatchlistSnapshot = { watchlist: [], ready: false, userId: null, pending: false, error: null };
type StorageAccess = () => Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Request = (userId: string, method: "GET" | "PUT" | "DELETE" | "POST", body?: object) => Promise<{ userId: string; items?: { ticker: string }[] }>;
const IMPORT_KEY = "kolvex:watchlist-import-id";
const OWNER_KEY = "kolvex:watchlist-import-owner";

/** A shared account-scoped store. No local-only writes or optimistic success. */
export function createWatchlistStore(request: Request, storage: StorageAccess) {
  let snapshot = EMPTY_WATCHLIST;
  let generation = 0;
  let revision = 0;
  let loading = false;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<WatchlistSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  };
  const matches = (id: string, version: number) => snapshot.userId === id && generation === version;

  async function refresh() {
    const id = snapshot.userId, version = generation, readRevision = revision;
    if (!id || loading || snapshot.pending) return;
    loading = true;
    let importing = false;
    try {
      let local: ReturnType<StorageAccess> | undefined;
      let legacy: string[] = [];
      let sourceId: string | null = null;
      try {
        local = storage();
        const owner = local.getItem(OWNER_KEY);
        if (!owner || owner === id) {
          legacy = parseWatchlist(local.getItem(WATCHLIST_KEY) ?? local.getItem(LEGACY_WATCHLIST_KEY));
          if (legacy.length) {
            local.setItem(OWNER_KEY, id);
            sourceId = local.getItem(IMPORT_KEY) ?? crypto.randomUUID();
            local.setItem(IMPORT_KEY, sourceId);
          }
        }
      } catch { local = undefined; } // Cloud storage works even when localStorage is blocked.
      if (legacy.length && local) {
        importing = true;
        if (legacy.length > 1000) throw Error("Too many legacy tickers");
        await request(id, "POST", { tickers: legacy, sourceId });
        if (!matches(id, version)) return;
        local.removeItem(WATCHLIST_KEY);
        local.removeItem(LEGACY_WATCHLIST_KEY);
        // Retain ownership so a different account cannot claim old data after a failed cleanup.
      }
      importing = false;
      const data = await request(id, "GET");
      if (matches(id, version) && revision === readRevision && !snapshot.pending) {
        if (data.userId !== id || !Array.isArray(data.items)) throw Error("Account or response mismatch");
        emit({ watchlist: data.items.map(item => item.ticker), ready: true, error: null });
      }
    } catch (error) {
      if (matches(id, version) && revision === readRevision) emit({ ready: true, error: error instanceof Error && error.message === "auth" ? "auth" : importing ? "migration" : "load" });
    } finally { if (matches(id, version)) loading = false; }
  }
  function setIdentity(userId: string | null) {
    if (snapshot.ready && snapshot.userId === userId) return;
    if (snapshot.userId === userId && loading) return;
    generation++; revision++; loading = false;
    emit({ ...EMPTY_WATCHLIST, userId, ready: !userId });
    if (userId) void refresh();
  }
  async function setTicker(value: string, saved: boolean): Promise<boolean> {
    const ticker = normalizeWatchlistTicker(value), id = snapshot.userId, version = generation;
    if (!ticker || !id || !snapshot.ready || snapshot.pending || snapshot.error) return false;
    revision++;
    emit({ pending: true });
    try {
      const data = await request(id, saved ? "PUT" : "DELETE", { ticker });
      if (!matches(id, version)) return false;
      if (data.userId !== id) throw Error("Account mismatch");
      emit({ watchlist: saved ? [...new Set([...snapshot.watchlist, ticker])] : snapshot.watchlist.filter(item => item !== ticker), error: null });
      return true;
    } catch (error) {
      if (matches(id, version)) emit({ error: error instanceof Error && error.message === "auth" ? "auth" : "save" });
      return false;
    } finally { if (matches(id, version)) emit({ pending: false }); }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setIdentity, refresh, setTicker,
    toggle: (value: string) => setTicker(value, !snapshot.watchlist.includes(normalizeWatchlistTicker(value) ?? "")),
  };
}
