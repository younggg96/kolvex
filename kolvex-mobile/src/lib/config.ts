export const apiURL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(
  /\/$/,
  "",
);
export const webURL = (process.env.EXPO_PUBLIC_WEB_URL ?? "").replace(
  /\/$/,
  "",
);
// Sample quotes exist for local design work only; a release without an API shows an error.
export const demoMode = !apiURL && (typeof __DEV__ === "undefined" || __DEV__);
export const supabaseURL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const authConfigured = !!supabaseURL && !!supabaseKey;
