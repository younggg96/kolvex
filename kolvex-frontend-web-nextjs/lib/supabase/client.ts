import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "./config";

/** Share the cookie-backed session with server components and middleware. */
export function createClient() {
  // Use the SSR adapter's default browser cookie handling, including token chunks.
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
