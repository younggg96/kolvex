"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  paperRequest,
  PaperApiError,
  sendCommand,
  type Account,
  type Command,
} from "@/lib/paperTrading";

/** Private, uncached account state for embedded trading. Pauses on inactive tabs. */
export function usePaperTradingAccount(active: boolean) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);
  const mounted = useRef(false);
  const lock = useRef(false);
  const accept = useCallback((next: Account) => {
    if (mounted.current)
      setAccount((previous) =>
        !previous || next.version >= previous.version ? next : previous,
      );
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const next = await paperRequest<Account>("account", { signal });
        if (!signal?.aborted && mounted.current) {
          accept(next);
          setError(null);
        }
      } catch (e) {
        if (!signal?.aborted && mounted.current) {
          setError(e);
          if (e instanceof PaperApiError && [401, 403].includes(e.status))
            setAccount(null);
        }
      } finally {
        if (!signal?.aborted && mounted.current) setLoading(false);
      }
    },
    [accept],
  );
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = () => {
      if (!document.hidden && !lock.current) void load(controller.signal);
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, load]);
  const execute = useCallback(
    async (command: Command): Promise<boolean> => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      setMutationError(null);
      try {
        const next = await sendCommand(command);
        if (mounted.current) {
          accept(next);
          setError(null);
        }
        return true;
      } catch (e) {
        if (mounted.current) {
          setMutationError(e);
          if (e instanceof PaperApiError && [401, 403].includes(e.status))
            setAccount(null);
        }
        return false;
      } finally {
        lock.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [accept],
  );
  return {
    account,
    loading,
    busy,
    error,
    mutationError,
    execute,
    reload: load,
  };
}
