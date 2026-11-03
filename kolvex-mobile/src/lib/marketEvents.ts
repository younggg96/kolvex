// Copied from the Web's lib/marketEvents.ts; a test keeps these in step.
export type MarketEvent = {
  id: string;
  title: string;
  title_en: string;
  category: "earnings" | "fed" | "economic" | "other";
  event_date: string;
  starts_at: string | null;
  timing: "scheduled" | "before_open" | "after_close" | "all_day" | "tbd";
  importance: "high" | "medium" | "low";
  is_hot: boolean;
  status: "draft" | "published" | "cancelled";
  summary: string;
  summary_en: string;
  tickers: string[];
  source_name: string;
  source_url: string | null;
};
export const EVENT_CATEGORIES = {
  earnings: ["Earnings", "财报"],
  fed: ["Federal Reserve", "美联储"],
  economic: ["Economic data", "经济数据"],
  other: ["Major event", "其他大事件"],
} as const;
export function eventTime(event: MarketEvent, english: boolean): string {
  if (event.starts_at)
    return new Intl.DateTimeFormat(english ? "en-US" : "zh-CN", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(event.starts_at));
  const labels = {
    before_open: ["Before open", "盘前"],
    after_close: ["After close", "盘后"],
    all_day: ["All day", "全天"],
    tbd: ["Time TBD", "时间待定"],
    scheduled: ["Time TBD", "时间待定"],
  };
  return labels[event.timing][english ? 0 : 1];
}
