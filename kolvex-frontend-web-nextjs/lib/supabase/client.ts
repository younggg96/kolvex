import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "./config";
import { setClientCacheIdentity } from "../clientCache";

const observed = new WeakSet<object>();

/** Share the cookie-backed session with server components and middleware. */
export function createClient() {
  // Use the SSR adapter's default browser cookie handling, including token chunks.
  const client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  if (typeof window !== "undefined" && !observed.has(client)) {
    observed.add(client);
    client.auth.onAuthStateChange((_event, session) => {
      setClientCacheIdentity(session?.user.id ?? null);
    });
  }
  return client;
}
