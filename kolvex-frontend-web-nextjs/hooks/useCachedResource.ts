"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadClientCache, peekClientCache, subscribeClientCache, type CacheOptions } from "@/lib/clientCache";

/** Show a recent snapshot immediately; refresh stale data without replacing it with a skeleton. */
export function useCachedResource<T>(key: string, loader: (signal: AbortSignal) => Promise<T>, options: Omit<CacheOptions, "signal" | "force"> = {}) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [revision, setRevision] = useState(0);
  const force = useRef(false);
  const [state, setState] = useState<{ key: string; data?: T; loading: boolean; refreshing: boolean; error: unknown }>(() => {
    const data = peekClientCache<T>(key);
    return { key, data, loading: data === undefined, refreshing: false, error: null };
  });
  const refresh = useCallback(() => { force.current = true; setRevision(value => value + 1); }, []);
  const revalidate = useCallback(() => setRevision(value => value + 1), []);
  const { ttl, maxAge, timeout } = options;
  useEffect(() => subscribeClientCache(prefix => {
    if (!key.startsWith(prefix)) return;
    setState(previous => prefix && previous.key === key
      ? { ...previous, refreshing: true, error: null }
      : { key, data: undefined, loading: true, refreshing: true, error: null });
    refresh();
  }), [key, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    const data = peekClientCache<T>(key);
    const forceRefresh = force.current;
    force.current = false;
    setState(previous => {
      const available = data ?? (previous.key === key ? previous.data : undefined);
      return { key, data: available, loading: available === undefined, refreshing: true, error: null };
    });
    const load = loaderRef.current;
    loadClientCache(key, load, { ttl, maxAge, timeout, force: forceRefresh, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ key, data, loading: false, refreshing: false, error: null }); })
      .catch(error => { if (!controller.signal.aborted) setState(previous => ({ key, data: [401, 403, 404].includes(error?.status) ? undefined : peekClientCache<T>(key) ?? (previous.key === key ? previous.data : undefined), loading: false, refreshing: false, error })); });
    return () => controller.abort();
  }, [key, revision, ttl, maxAge, timeout]);
  const data = state.key === key ? state.data : peekClientCache<T>(key);
  return { data, loading: state.key === key ? state.loading : data === undefined, refreshing: state.key === key ? state.refreshing : true, error: state.key === key ? state.error : null, refresh, revalidate };
}
