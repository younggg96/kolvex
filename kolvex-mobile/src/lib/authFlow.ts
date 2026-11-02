import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";
export const authRedirect = () =>
  makeRedirectUri({ scheme: "kolvex", path: "auth/callback" });
let exchange:
  { code: string; result: Promise<{ recovery: boolean }> } | undefined;
export async function completeAuth(code: string) {
  if (!code || code.length > 4096 || !supabase)
    throw new Error("登录链接无效，请重新登录。");
  if (exchange?.code === code) return exchange.result;
  const result = (async () => {
    let recovery = false;
    const { data: listener } = supabase!.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recovery = true;
    });
    const response = await supabase!.auth
      .exchangeCodeForSession(code)
      .finally(() => listener.subscription.unsubscribe());
    if (response.error)
      throw new Error("登录链接已过期或无法在此设备验证，请重新发起登录。");
    return { recovery: recovery };
  })();
  exchange = { code, result };
  return result;
}
export async function oauth(provider: "google" | "apple") {
  if (!supabase) throw new Error("账户服务未配置");
  const redirectTo = authRedirect();
  const result = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (result.error || !result.data.url)
    throw new Error("此登录方式暂不可用，请检查账户服务配置。");
  const response = await WebBrowser.openAuthSessionAsync(
    result.data.url,
    redirectTo,
  );
  if (response.type !== "success") return false;
  const url = new URL(response.url);
  const expected = new URL(redirectTo);
  if (
    url.protocol !== expected.protocol ||
    url.host !== expected.host ||
    url.pathname !== expected.pathname
  )
    throw new Error("登录回调地址不匹配。");
  const code = url.searchParams.get("code");
  if (!code) throw new Error("未收到登录凭据，请重试。");
  await completeAuth(code);
  return true;
}
