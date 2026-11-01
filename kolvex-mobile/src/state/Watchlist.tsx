import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "./Auth";
import { supabase } from "../lib/supabase";
import { useResource } from "../lib/useResource";
import { isSymbol } from "../lib/models";

const Context = createContext<{
  symbols: string[];
  ready: boolean;
  error?: string;
  toggle: (symbol: string) => void;
  pending: boolean;
  cloud: boolean;
  refresh: () => void;
}>({
  symbols: [],
  ready: false,
  pending: false,
  cloud: false,
  refresh: () => {},
  toggle: () => {},
});
function GuestWatchlistProvider({ children }: PropsWithChildren) {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const queue = useRef(Promise.resolve());
  const current = useRef<string[]>([]);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem("kolvex.mobile.watchlist")
      .then((raw) => {
        const saved: unknown = raw ? JSON.parse(raw) : [];
        if (active && Array.isArray(saved)) {
          current.current = [
            ...new Set(
              saved.filter(
                (s): s is string => typeof s === "string" && isSymbol(s),
              ),
            ),
          ];
          setSymbols(current.current);
        }
      })
      .catch(() => {
        if (active)
          setError("无法读取本机自选，新增自选仍可在本次使用中保留。");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  function toggle(symbol: string) {
    if (!ready || !isSymbol(symbol)) return;
    const old = current.current;
    const next = old.includes(symbol)
      ? old.filter((s) => s !== symbol)
      : [...old, symbol];
    current.current = next;
    setSymbols(next);
    queue.current = queue.current
      .then(() =>
        AsyncStorage.setItem("kolvex.mobile.watchlist", JSON.stringify(next)),
      )
      .then(() => setError(undefined))
      .catch(() => setError("自选未保存到本机，请再次操作重试。"));
  }
  return (
    <Context.Provider
      value={{
        symbols,
        ready,
        error,
        toggle,
        pending: false,
        cloud: false,
        refresh: () => {},
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useWatchlist = () => useContext(Context);

function CloudWatchlistProvider({
  children,
  userId,
}: PropsWithChildren<{ userId: string }>) {
  const alive = useRef(true);
  const operation = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState<string>();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      operation.current?.abort();
    };
  }, []);
  const data = useResource(`watchlist:${userId}`, async (signal) => {
    const items: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await supabase!
        .from("user_watchlist")
        .select("ticker")
        .eq("user_id", userId)
        .order("created_at")
        .order("ticker")
        .range(offset, offset + 999)
        .abortSignal(signal);
      if (result.error)
        throw new Error("云端自选暂时无法读取，请检查网络并重试。");
      items.push(...(result.data ?? []).map((item) => item.ticker as string));
      if (!result.data || result.data.length < 1000) break;
    }
    return items;
  });
  const refresh = data.refresh;
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  async function save(symbol: string) {
    if (lock.current || data.loading || !data.data) return;
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) {
      setMutationError("云端自选仅支持最长 10 位的股票或 ETF 代码。");
      return;
    }
    lock.current = true;
    const controller = new AbortController();
    operation.current = controller;
    const deadline = setTimeout(() => controller.abort(), 20000);
    setPending(true);
    setMutationError(undefined);
    try {
      const account = await supabase!.auth.getSession();
      if (account.data.session?.user.id !== userId)
        throw new Error("账户已切换，请重新打开页面。");
      const result = data.data.includes(symbol)
        ? await supabase!
            .from("user_watchlist")
            .delete()
            .eq("user_id", userId)
            .eq("ticker", symbol)
            .abortSignal(controller.signal)
        : await supabase!
            .from("user_watchlist")
            .insert({ user_id: userId, ticker: symbol })
            .abortSignal(controller.signal);
      if (result.error && result.error.code !== "23505")
        throw new Error("自选保存未确认，请刷新检查后再试。");
      if (alive.current) data.refresh();
    } catch (error) {
      if (alive.current)
        setMutationError(
          error instanceof Error ? error.message : "自选保存未确认，请刷新。",
        );
    } finally {
      clearTimeout(deadline);
      operation.current = null;
      lock.current = false;
      if (alive.current) setPending(false);
    }
  }
  return (
    <Context.Provider
      value={{
        symbols: data.data ?? [],
        ready: !!data.data,
        error: mutationError ?? data.error,
        toggle: (symbol) => {
          void save(symbol);
        },
        pending: pending || data.loading,
        cloud: true,
        refresh: data.refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function WatchlistProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  return session ? (
    <CloudWatchlistProvider key={session.user.id} userId={session.user.id}>
      {children}
    </CloudWatchlistProvider>
  ) : (
    <GuestWatchlistProvider>{children}</GuestWatchlistProvider>
  );
}
