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
export const BRIEF_TYPES = ["morning", "intraday", "evening"] as const;
export type BriefType = typeof BRIEF_TYPES[number];
export function isBriefType(value?: string): value is BriefType {
  return BRIEF_TYPES.some(type => type === value);
}

export type BriefLanguage = "zh" | "en";
export interface LocalizedBrief {
  title: string;
  headline: string;
  subtitle?: string;
  sections: BriefSection[];
  disclaimer?: string;
  hero_image?: BriefImage | null;
}
export interface DailyBrief {
  schema_version: "kolvex-brief/1.0";
  language?: BriefLanguage;
  translations?: Partial<Record<BriefLanguage, LocalizedBrief>>;
  brief: { id: string; type: BriefType; date: string; title: string; headline: string; subtitle: string; generated_at_pt: string; market_status: "trading_day" | "weekend"; hero_image?: BriefImage | null };
  sections: BriefSection[];
  disclaimer?: string;
}
/** Display uploaded copy only; never translate or mutate the stored envelope. */
export function localizedBrief(document: DailyBrief, locale: BriefLanguage): DailyBrief {
  const language = document.language ?? "zh";
  const copy = locale !== language ? document.translations?.[locale] : undefined;
  if (!copy) return document;
  return {
    ...document,
    language: locale,
    brief: { ...document.brief, title: copy.title, headline: copy.headline,
      subtitle: copy.subtitle ?? "", hero_image: copy.hero_image ?? document.brief.hero_image },
    sections: copy.sections,
    disclaimer: copy.disclaimer ?? "",
  };
}

export interface SavedBrief { id: string; brief_date: string; brief_type: BriefType; title: string; headline: string }

export async function briefRequest<T>(query = "", body?: string, signal?: AbortSignal, mutation?: { method: "PUT" | "DELETE"; revision: string }): Promise<T> {
  const response = await fetch(`/api/admin/briefs${query}`, {
    method: mutation?.method ?? (body === undefined ? "GET" : "POST"),
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(mutation ? { "If-Match": mutation.revision } : {}) },
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
export type BriefFilter = "all" | BriefType;
export interface BriefSearchParams { type?: string; page?: string; date?: string }
export interface BriefCalendarData { month: string; days: { date: string; types: BriefType[] }[] }

export function briefFilters(params?: BriefSearchParams, now = new Date()) {
  const type: BriefFilter = isBriefType(params?.type) ? params.type : "all";
  const value = Number(params?.page || 1);
  const page = Number.isSafeInteger(value) && value > 0 && value <= 1000000 ? value : 1;
  // Opening the reader always shows one Pacific date, including empty days.
  const date = params?.date && isBriefDate(params.date) ? params.date : pacificBriefToday(now);
  return { type, page, date };
}

/** Regular US equities session: 06:30–13:00 Pacific; post-close brief at 14:00. */
export function briefReadingFilters(params?: BriefSearchParams, now = new Date()) {
  const { date } = briefFilters(params, now);
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Los_Angeles",
  }).formatToParts(now);
  const minutes = Number(parts.find(part => part.type === "hour")!.value) * 60
    + Number(parts.find(part => part.type === "minute")!.value);
  const type: BriefType = isBriefType(params?.type)
    ? params.type : minutes < 390 ? "morning" : minutes < 840 ? "intraday" : "evening";
  return { date, type, id: `${type}-${date}` };
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
