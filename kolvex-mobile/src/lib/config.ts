export const apiURL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(
  /\/$/,
  "",
);
export const webURL = (process.env.EXPO_PUBLIC_WEB_URL ?? "").replace(
  /\/$/,
  "",
);
export const demoMode = !apiURL;
export const supabaseURL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const authConfigured = !!supabaseURL && !!supabaseKey;
