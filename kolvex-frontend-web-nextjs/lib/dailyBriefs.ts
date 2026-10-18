export interface BriefImage { url: string; caption: string; credit: string; source_page: string }
export interface BriefItem {
  title: string; summary: string; kicker: string;
  key_stats: { label: string; value: string | number }[];
  image?: BriefImage | null;
  sources: { name: string; url: string }[];
  related_tickers: string[];
  impact?: { short_term: string; long_term: string; price_range: string; positioning: string } | null;
  time_pt: string; detail: string; checklist: string[];
}
export interface BriefSection {
  section_id: string; order: number; title: string; subtitle: string;
  narrative: string | string[]; paragraphs: string[];
  indices: { name: string; prev_close: number | null; close: number | null; change_pct: number | null; note: string | null }[];
  movers_up: { name: string; detail: string }[];
  movers_down: { name: string; detail: string }[];
  commodities: { name: string; detail: string }[];
  items: BriefItem[];
  takeaway: string; strategy_line: string;
  events: { date_label: string; title: string; detail: string }[];
}
export interface DailyBrief {
  schema_version: "kolvex-brief/1.0";
  brief: { id: string; type: "morning" | "evening"; date: string; title: string; headline: string; subtitle: string; generated_at_pt: string; market_status: "trading_day" | "weekend"; hero_image?: BriefImage | null };
  sections: BriefSection[];
  disclaimer?: string;
}
export interface SavedBrief { id: string; brief_date: string; brief_type: string; title: string; headline: string }

export async function briefRequest<T>(query = "", body?: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/admin/briefs${query}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body, signal: signal ?? AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败，请重试。");
  return data;
}
