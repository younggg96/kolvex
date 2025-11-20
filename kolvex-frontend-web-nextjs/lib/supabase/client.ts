import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "./config";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

