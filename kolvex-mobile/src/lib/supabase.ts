import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { authConfigured, supabaseKey, supabaseURL } from "./config";
import { createSessionStorage } from "./secureStorage";
function publicKeyOnly(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
        .role === "anon"
    );
  } catch {
    return false;
  }
}
if (
  authConfigured &&
  (!publicKeyOnly(supabaseKey) || !supabaseURL.startsWith("https://"))
)
  throw new Error(
    "手机端仅接受 HTTPS Supabase 地址及 publishable / anon 公共密钥。",
  );
export const supabase = authConfigured
  ? createClient(supabaseURL, supabaseKey, {
      auth: {
        storage:
          Platform.OS === "web" ? undefined : createSessionStorage(SecureStore),
        autoRefreshToken: true,
        persistSession: Platform.OS !== "web",
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;
