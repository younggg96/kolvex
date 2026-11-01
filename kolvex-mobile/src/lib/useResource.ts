import { useCallback, useEffect, useEffectEvent, useState } from "react";

export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const run = useEffectEvent(load);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    revision: number;
    data?: T;
    error?: string;
  }>({ key, revision: -1 });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const finishError = (error: string) =>
      setState((old) => ({
        key,
        revision,
        data: old.key === key ? old.data : undefined,
        error,
      }));
    const timeout = setTimeout(() => {
      active = false;
      controller.abort();
      finishError("连接超时，请检查网络后重试。");
    }, 15000);
    run(controller.signal)
      .then((data) => {
        if (active) setState({ key, revision, data });
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
  }, [key, revision]);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  const loading = state.key !== key || state.revision !== revision;
  return {
    data: state.key === key ? state.data : undefined,
    error: loading ? undefined : state.error,
    loading,
    refresh,
  };
}
