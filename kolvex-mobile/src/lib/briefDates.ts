import { isBriefType } from "./contentTypes";

const pacificClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function isBriefDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && dateKey(parsed) === value;
}

export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const utcBriefDate = (date: string) => new Date(`${date}T12:00:00Z`);

export function isWeekendBriefDate(date: string) {
  const day = utcBriefDate(date).getUTCDay();
  return day === 0 || day === 6;
}

export function shiftBriefDate(value: string, days: number) {
  const date = utcBriefDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function briefReadingDate(
  params: { date?: string; type?: string },
  now = new Date(),
) {
  const parts = pacificClock.formatToParts(now);
  const get = (key: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === key)?.value;
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  const date = isBriefDate(params.date) ? params.date : today;
  const minute = Number(get("hour")) * 60 + Number(get("minute"));
  const type = isWeekendBriefDate(date)
    ? "evening"
    : isBriefType(params.type)
      ? params.type
      : minute < 390
        ? "morning"
        : minute < 840
          ? "intraday"
          : "evening";
  return { date, today, type, id: `${type}-${date}` };
}

export const editionNames = {
  morning: "盘前 1 小时",
  intraday: "盘中",
  evening: "盘后 1 小时",
} as const;
