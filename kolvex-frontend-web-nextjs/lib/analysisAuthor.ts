import type { AnalysisVersion } from "./stockAnalysisHistory";

/** Shared author label for analysis versions and anything derived from them. */
export function authorLabel<T>(item: AnalysisVersion<T>, c: (en: string, zh: string) => string) {
  if (item.is_owner) return c("You", "我");
  return item.author?.username || item.author?.full_name || c(`User ${item.user_id?.slice(0, 8) || ""}`, `用户 ${item.user_id?.slice(0, 8) || ""}`);
}
