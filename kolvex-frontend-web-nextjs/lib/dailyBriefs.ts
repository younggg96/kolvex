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

export interface BriefSummary extends SavedBrief {
  summary?: DailyBrief["brief"];
}
export interface BriefList { items: BriefSummary[]; total: number }
export type BriefFilter = "all" | "morning" | "evening";
export interface BriefSearchParams { type?: string; page?: string; date?: string }
export interface BriefCalendarData { month: string; days: { date: string; types: ("morning" | "evening")[] }[] }

export function briefFilters(params?: BriefSearchParams) {
  const type: BriefFilter = params?.type === "morning" || params?.type === "evening" ? params.type : "all";
  const value = Number(params?.page || 1);
  const page = Number.isSafeInteger(value) && value > 0 && value <= 1000000 ? value : 1;
  const date = isBriefDate(params?.date) ? params!.date : undefined;
  return { type, page, date };
}
export function briefLibraryHref(type: BriefFilter = "all", page = 1, date?: string) {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (page !== 1) params.set("page", String(page));
  if (isBriefDate(date)) params.set("date", date!);
  return `/dashboard/briefs${params.size ? `?${params}` : ""}`;
}
export function briefArticleHref(id: string, type: BriefFilter = "all", page = 1, date?: string) {
  return `/dashboard/briefs/${encodeURIComponent(id)}${briefLibraryHref(type, page, date).replace("/dashboard/briefs", "")}`;
}
export function formatBriefDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}


export function isBriefDate(value?: string): boolean {
  if (!value || value.startsWith("0000") || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Calendar cells use local calendar dates; issue "today" always uses Pacific time. */
export function briefDateKey(value: Date): string {
  return `${String(value.getFullYear()).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function briefCalendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(0);
  result.setFullYear(year, month - 1, day);
  result.setHours(12, 0, 0, 0);
  return result;
}
export function shiftBriefDate(value: string, days: number): string {
  const date = briefCalendarDate(value);
  date.setDate(date.getDate() + days);
  return briefDateKey(date);
}
export function pacificBriefToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Los_Angeles" }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
