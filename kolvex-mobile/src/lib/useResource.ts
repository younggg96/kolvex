import { useCallback, useEffect, useEffectEvent, useState } from "react";

/**
 * In-memory results of resources loaded with `{ cache: true }`, kept for the app's
 * lifetime so a screen that remounts shows its last data at once while it revalidates.
 */
const cache = new Map<string, unknown>();

/** The last cached result for `key`, if a cached resource has loaded it. */
export function peekResource<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 15000,
  options: { cache?: boolean } = {},
) {
  const cached = options.cache === true;
  const run = useEffectEvent(load);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    revision: number;
    data?: T;
    error?: string;
  }>(() => ({
    key,
    revision: -1,
    data: cached ? (cache.get(key) as T | undefined) : undefined,
  }));
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const finishError = (error: string) =>
      setState((old) => ({
        key,
        revision,
        data:
          old.key === key
            ? old.data
            : cached
              ? (cache.get(key) as T | undefined)
              : undefined,
        error,
      }));
    const timeout = setTimeout(() => {
      active = false;
      controller.abort();
      finishError("连接超时，请检查网络后重试。");
    }, timeoutMs);
    run(controller.signal)
      .then((data) => {
        if (!active) return;
        if (cached) cache.set(key, data);
        setState({ key, revision, data });
      })
      .catch((error) => {
        if (active)
          finishError(
            error instanceof Error ? error.message : "加载失败，请重试。",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [key, revision, timeoutMs, cached]);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  const loading = state.key !== key || state.revision !== revision;
  return {
    data:
      state.key === key
        ? state.data
        : cached
          ? (cache.get(key) as T | undefined)
          : undefined,
    error: loading ? undefined : state.error,
    loading,
    refresh,
  };
}
