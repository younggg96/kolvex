/** Outside every US trading session quotes do not move, so pollers can wait this long. */
export const CLOSED_MARKET_POLL_MS = 5 * 60_000;

const NEW_YORK_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});

/**
 * True from 20:00 to 04:00 New York time and all weekend: no pre-market, regular or
 * after-hours trading. Exchange holidays are not modelled (they just poll normally).
 */
export function usMarketsClosed(now: Date = new Date()): boolean {
  const parts = NEW_YORK_PARTS.formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  if (weekday === "Sat" || weekday === "Sun") return true;
  return hour < 4 || hour >= 20;
}
