/** Browser-only, bounded read cache. Never shares authenticated responses on the server. */
type Entry = { data?: unknown; at: number; ttl: number; maxAge: number; promise?: Promise<unknown>; controller?: AbortController };
export interface CacheOptions { ttl?: number; maxAge?: number; force?: boolean; signal?: AbortSignal; timeout?: number }
const entries = new Map<string, Entry>();
const listeners = new Set<(prefix: string) => void>();
let identity: string | null | undefined;
const browser = () => typeof window !== "undefined";
const cancelled = () => new DOMException("Request cancelled", "AbortError");

export function peekClientCache<T>(key: string, fresh = false): T | undefined {
  if (!browser()) return undefined;
  const entry = entries.get(key);
  if (!entry || entry.data === undefined || Date.now() - entry.at > (fresh ? entry.ttl : entry.maxAge)) return undefined;
  return entry.data as T;
}

export function writeClientCache<T>(key: string, data: T, ttl = 60_000, maxAge = ttl) {
  if (!browser()) return;
  if (entries.size >= 160 && !entries.has(key)) entries.delete(entries.keys().next().value!);
  entries.set(key, { data, at: Date.now(), ttl, maxAge });
}

export function invalidateClientCache(prefix = "") {
  for (const [key, entry] of entries) {
    if (!key.startsWith(prefix)) continue;
    entries.delete(key);
    entry.controller?.abort();
  }
  // Auth callbacks stay synchronous and never await other Supabase operations.
  for (const listener of listeners) queueMicrotask(() => listener(prefix));
}

export function setClientCacheIdentity(next: string | null) {
  if (identity === next) return;
  identity = next;
  invalidateClientCache();
}

export function subscribeClientCache(listener: (prefix: string) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Cancelling one reader must not cancel the same request used by another mounted view. */
function forReader<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(cancelled()); };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(value => { signal.removeEventListener("abort", abort); if (!signal.aborted) resolve(value); },
      error => { signal.removeEventListener("abort", abort); reject(error); });
  });
}

export function loadClientCache<T>(key: string, loader: (signal: AbortSignal) => Promise<T>, options: CacheOptions = {}): Promise<T> {
  if (options.signal?.aborted) return Promise.reject(cancelled());
  const ttl = options.ttl ?? 60_000;
  const saved = browser() ? entries.get(key) : undefined;
  if (saved?.promise) return forReader(saved.promise as Promise<T>, options.signal);
  if (!options.force && saved?.data !== undefined && Date.now() - saved.at < saved.ttl) return forReader(Promise.resolve(saved.data as T), options.signal);
  const controller = new AbortController();
  const entry: Entry = { data: saved?.data, at: saved?.at ?? 0, ttl, maxAge: options.maxAge ?? Math.max(ttl, 15 * 60_000), controller };
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 20_000);
  let abort: () => void;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(cancelled());
    controller.signal.addEventListener("abort", abort, { once: true });
  });
  const promise = Promise.race([(async () => loader(controller.signal))(), aborted]).then(data => {
    if (controller.signal.aborted) throw cancelled();
    if (browser() && entries.get(key) === entry) {
      entry.data = data; entry.at = Date.now(); entry.promise = undefined; entry.controller = undefined;
    }
    return data;
  }).catch(error => {
    if (browser() && entries.get(key) === entry) {
      if (entry.data === undefined || [401, 403, 404].includes(error?.status)) entries.delete(key);
      else { entry.promise = undefined; entry.controller = undefined; }
    }
    throw error;
  }).finally(() => { clearTimeout(timer); controller.signal.removeEventListener("abort", abort); });
  entry.promise = promise;
  if (browser()) {
    if (entries.size >= 160 && !entries.has(key)) {
      const oldest = entries.keys().next().value!;
      entries.get(oldest)?.controller?.abort();
      entries.delete(oldest);
    }
    entries.delete(key); entries.set(key, entry);
  }
  return forReader(promise, options.signal);
}
