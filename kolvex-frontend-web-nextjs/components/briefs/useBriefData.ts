"use client";

import { useCallback, useEffect, useState } from "react";

interface Resource<T> { path: string; data: T | null; loading: boolean; error: number | null }

/** No persistent cache: newly imported briefs appear on entry, focus and refresh. */
export function useBriefData<T>(path: string) {
  const [state, setState] = useState<Resource<T>>({ path, data: null, loading: true, error: null });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setState({ path, data: null, loading: true, error: null });
    void (async () => {
      try {
        const response = await fetch(`/api/briefs${path}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          if (active) setState({ path, data: null, loading: false, error: response.status });
          return;
        }
        const data = await response.json() as T;
        if (active) setState({ path, data, loading: false, error: null });
      } catch {
        if (active) setState({ path, data: null, loading: false, error: 503 });
      } finally { clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [path, revision]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") retry(); };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); };
  }, [retry]);

  return { ...(state.path === path ? state : { data: null, loading: true, error: null }), retry };
}
