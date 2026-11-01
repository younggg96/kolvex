import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { isSymbol } from "../lib/models";

const Context = createContext<{
  symbols: string[];
  ready: boolean;
  error?: string;
  toggle: (symbol: string) => void;
}>({ symbols: [], ready: false, toggle: () => {} });
export function WatchlistProvider({ children }: PropsWithChildren) {
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
    <Context.Provider value={{ symbols, ready, error, toggle }}>
      {children}
    </Context.Provider>
  );
}
export const useWatchlist = () => useContext(Context);
