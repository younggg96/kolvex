/** Outside every US trading session quotes do not move, so pollers can wait this long. */
export const CLOSED_MARKET_POLL_MS = 5 * 60_000;

const NEW_YORK_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});

/** The overnight window starts Sunday evening and ends Friday before pre-market. */
export function usMarketsClosed(now: Date = new Date()): boolean {
  const parts = NEW_YORK_PARTS.formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return (
    weekday === "Sat" ||
    (weekday === "Sun" && hour < 20) ||
    (weekday === "Fri" && hour >= 20)
  );
}

const NEW_YORK_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/**
 * True during the regular US session, 09:30–16:00 New York time on weekdays.
 * Exchange holidays are not modelled.
 */
export function usRegularSessionOpen(now: Date = new Date()): boolean {
  const parts = NEW_YORK_CLOCK.formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  if (weekday === "Sat" || weekday === "Sun") return false;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}
