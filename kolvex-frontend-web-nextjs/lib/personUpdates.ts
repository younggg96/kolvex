export interface PersonUpdate {
  id: string;
  person: string;
  person_cn: string;
  published_at: string;
  title: string;
  summary: string;
  source_url: string;
  impact: "high" | "medium" | "low";
  tags: string[];
  tickers: string[];
  image_url: string | null;
  image_alt: string | null;
}

export const PERSON_UPDATE_ZONES = [
  ["America/Los_Angeles", "PT", "PT"],
  ["America/New_York", "ET", "ET"],
  ["Asia/Shanghai", "Beijing time", "北京时间"],
] as const;

export function personUpdateTime(timestamp: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}
