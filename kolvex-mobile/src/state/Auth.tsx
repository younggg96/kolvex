import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { configureIdentity } from "../lib/http";
type Auth = {
  session: Session | null;
  ready: boolean;
  error?: string;
  signOut: () => Promise<void>;
};
const Context = createContext<Auth>({
  session: null,
  ready: false,
  signOut: async () => {},
});
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    let authEvents = 0;
    configureIdentity(async () => {
      const result = await supabase?.auth.getSession();
      const s = result?.data.session;
      return result?.error || !s
        ? null
        : { token: s.access_token, userId: s.user.id };
    });
    const { data } = supabase?.auth.onAuthStateChange((_event, value) => {
      if (active) {
        authEvents += 1;
        if (value) setError(undefined);
        setSession(value);
        setReady(true);
      }
    }) ?? { data: null };
    supabase?.auth
      .getSession()
      .then((result) => {
        if (!active || authEvents > 0) return;
        if (result.error) setError("会话恢复失败，请重新登录。");
        setSession(result.data.session);
        setReady(true);
      })
      .catch(() => {
        if (active && authEvents === 0) {
          setError("无法读取安全会话，请重新登录。");
          setReady(true);
        }
      });
    if (!supabase)
      Promise.resolve().then(() => {
        if (active) setReady(true);
      });
    if (AppState.currentState === "active") supabase?.auth.startAutoRefresh();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    });
    return () => {
      active = false;
      data?.subscription.unsubscribe();
      listener.remove();
      supabase?.auth.stopAutoRefresh();
      configureIdentity(async () => null);
    };
  }, []);
  async function signOut() {
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) throw new Error("退出未完成，请重试。");
    setSession(null);
    setError(undefined);
  }
  return (
    <Context.Provider value={{ session, ready, error, signOut }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
