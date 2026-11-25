/** Creator opinions and US price-chart annotations use the same New York day. */
export const OPINION_TIME_ZONE = "America/New_York";

// Building an Intl formatter costs far more than formatting; list sorts call this per comparison.
const opinionDayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: OPINION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function opinionDay(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = opinionDayFormat.formatToParts(parsed);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Month and day only, for narrow rails such as "11/3". */
export function formatOpinionDateShort(value: string | null | undefined, locale: string): string {
  const day = opinionDay(value);
  if (!day) return "";
  const parsed = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(parsed);
}

export function formatOpinionDate(value: string | null | undefined, locale: string): string {
  const day = opinionDay(value);
  if (!day) return "";
  // Calendar dates are labels, not midnight UTC instants in the viewer's zone.
  const parsed = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}
