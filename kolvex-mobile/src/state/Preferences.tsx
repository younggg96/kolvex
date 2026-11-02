import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Appearance as NativeAppearance, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "../lib/http";
export type Appearance = "LIGHT" | "DARK" | "SYSTEM";
type Preferences = { theme: Appearance; locale: "zh" | "en" };
const initial: Preferences = { theme: "SYSTEM", locale: "zh" };
const Context = createContext({
  ...initial,
  error: undefined as string | undefined,
  save: async (_value: Partial<Preferences>) => {},
});
export function PreferencesProvider({
  children,
  user,
}: { user?: string } & PropsWithChildren) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();
  const revision = useRef(0);
  const active = useRef(true);
  const last = useRef(initial);
  useEffect(() => {
    if (Platform.OS === "web") return;
    NativeAppearance.setColorScheme(
      value.theme === "SYSTEM"
        ? "auto"
        : value.theme === "DARK"
          ? "dark"
          : "light",
    );
    return () => NativeAppearance.setColorScheme("auto");
  }, [value.theme]);
  const key = `kolvex-preferences:${user || "guest"}`;
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    const started = revision.current;
    async function load() {
      try {
        const local = await AsyncStorage.getItem(key);
        if (local && active.current && revision.current === started) {
          const data = JSON.parse(local);
          const restored = {
            theme: ["LIGHT", "DARK", "SYSTEM"].includes(data.theme)
              ? data.theme
              : "SYSTEM",
            locale: data.locale === "en" ? "en" : "zh",
          } as Preferences;
          setValue(restored);
          last.current = restored;
        }
        if (user) {
          const remote = await apiRequest<{
            theme?: Appearance;
            locale?: "zh" | "en";
          }>("/users/me", {
            signal: controller.signal,
            authenticated: true,
            expectedUser: user,
          });
          if (active.current && revision.current === started) {
            const restored = {
              theme: remote.theme || "SYSTEM",
              locale: remote.locale || "zh",
            } as Preferences;
            setValue(restored);
            last.current = restored;
          }
        }
      } catch {
        if (active.current) setError("偏好暂时无法同步，可重新保存。");
      }
    }
    void load();
    return () => {
      active.current = false;
      controller.abort();
    };
  }, [key, user]);
  async function save(patch: Partial<Preferences>) {
    revision.current++;
    setError(undefined);
    if (user) {
      if (patch.theme)
        await apiRequest("/users/me/theme", {
          method: "PATCH",
          body: { theme: patch.theme },
          authenticated: true,
          expectedUser: user,
        });
      if (patch.locale)
        await apiRequest("/users/me/locale", {
          method: "PATCH",
          body: { locale: patch.locale },
          authenticated: true,
          expectedUser: user,
        });
    }
    if (!active.current) return;
    const next = { ...last.current, ...patch };
    await AsyncStorage.setItem(key, JSON.stringify(next));
    if (active.current) {
      last.current = next;
      setValue(next);
    }
  }
  return (
    <Context.Provider value={{ ...value, error, save }}>
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
