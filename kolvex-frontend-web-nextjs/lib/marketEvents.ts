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
export type MarketEventEnvelope = {
  schema_version: "kolvex-market-events/1.0";
  timezone: "America/New_York";
  events: MarketEvent[];
};
export type MarketCalendar = MarketEventEnvelope & {
  today: string;
  start_date: string;
  end_date_exclusive: string;
  total: number;
  page: number;
};
export const EVENT_CATEGORIES = {
  earnings: ["Earnings", "财报"],
  fed: ["Federal Reserve", "美联储"],
  economic: ["Economic data", "经济数据"],
  other: ["Major event", "其他大事件"],
} as const;
export function calendarDays(
  start: string,
  offset: number,
  count = 7,
): string[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset + i);
    return date.toISOString().slice(0, 10);
  });
}
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

export function eventOrder(event: MarketEvent): number {
  if (!event.starts_at)
    return {
      all_day: -2,
      before_open: -1,
      after_close: 1440,
      tbd: 1441,
      scheduled: 1441,
    }[event.timing];
  const [hour, minute] = eventTime(event, true).split(":").map(Number);
  return hour * 60 + minute;
}
