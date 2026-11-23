"""NYSE trading calendar (America/New_York) for daily market-risk data.

Rules cover regular holidays with weekend observance, plus the unscheduled
full-day closures since 1990. Early closes only move the session close time.
"""

from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

NEW_YORK = ZoneInfo("America/New_York")

SPECIAL_CLOSURES = frozenset(
    {
        date(1994, 4, 27),  # President Nixon funeral
        date(2001, 9, 11),  # September 11 attacks
        date(2001, 9, 12),
        date(2001, 9, 13),
        date(2001, 9, 14),
        date(2004, 6, 11),  # President Reagan funeral
        date(2007, 1, 2),  # President Ford funeral
        date(2012, 10, 29),  # Hurricane Sandy
        date(2012, 10, 30),
        date(2018, 12, 5),  # President G.H.W. Bush funeral
        date(2025, 1, 9),  # President Carter funeral
    }
)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    first = date(year, month, 1)
    return first + timedelta(days=(weekday - first.weekday()) % 7 + 7 * (n - 1))


def _last_weekday(year: int, month: int, weekday: int) -> date:
    nxt = date(year + month // 12, month % 12 + 1, 1)
    last = nxt - timedelta(days=1)
    return last - timedelta(days=(last.weekday() - weekday) % 7)


def _easter(year: int) -> date:
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    m = (32 + 2 * e + 2 * i - h - k) % 7
    n = (a + 11 * h + 22 * m) // 451
    month = (h + m - 7 * n + 114) // 31
    day = (h + m - 7 * n + 114) % 31 + 1
    return date(year, month, day)


def _observed(day: date) -> date:
    if day.weekday() == 5:
        return day - timedelta(days=1)
    if day.weekday() == 6:
        return day + timedelta(days=1)
    return day


@lru_cache(maxsize=128)
def nyse_holidays(year: int) -> frozenset[date]:
    days = set()
    new_year = date(year, 1, 1)
    if new_year.weekday() == 6:
        days.add(new_year + timedelta(days=1))
    elif new_year.weekday() < 5:
        days.add(new_year)
    # A Saturday New Year's Day is not observed on the prior Friday (NYSE Rule 7.2).
    if year >= 1998:
        days.add(_nth_weekday(year, 1, 0, 3))  # Martin Luther King Jr. Day
    days.add(_nth_weekday(year, 2, 0, 3))  # Washington's Birthday
    days.add(_easter(year) - timedelta(days=2))  # Good Friday
    days.add(_last_weekday(year, 5, 0))  # Memorial Day
    if year >= 2022:
        days.add(_observed(date(year, 6, 19)))  # Juneteenth
    days.add(_observed(date(year, 7, 4)))
    days.add(_nth_weekday(year, 9, 0, 1))  # Labor Day
    days.add(_nth_weekday(year, 11, 3, 4))  # Thanksgiving
    days.add(_observed(date(year, 12, 25)))
    days.update(day for day in SPECIAL_CLOSURES if day.year == year)
    return frozenset(days)


def is_trading_day(day: date) -> bool:
    return day.weekday() < 5 and day not in nyse_holidays(day.year)


def is_early_close(day: date) -> bool:
    """13:00 ET closes: July 3, the day after Thanksgiving, and December 24."""
    if not is_trading_day(day):
        return False
    if day == _nth_weekday(day.year, 11, 3, 4) + timedelta(days=1):
        return True
    return (day.month, day.day) in ((7, 3), (12, 24))


def previous_trading_day(day: date) -> date:
    day -= timedelta(days=1)
    while not is_trading_day(day):
        day -= timedelta(days=1)
    return day


def trading_days(start: date, end: date) -> list[date]:
    """Trading days in [start, end]."""
    days, cur = [], start
    while cur <= end:
        if is_trading_day(cur):
            days.append(cur)
        cur += timedelta(days=1)
    return days


def session_close_utc(day: date, close: time = time(16, 0)) -> datetime:
    """Close time of ``day`` in UTC. ``close`` is the regular close; early closes are 3h earlier."""
    local = datetime.combine(day, close, tzinfo=NEW_YORK)
    if is_early_close(day):
        local -= timedelta(hours=3)
    return local.astimezone(timezone.utc)


def latest_completed_trading_day(now: datetime, close: time = time(16, 0)) -> date:
    """Most recent trading day whose close (``close`` ET) is at or before ``now``."""
    day = now.astimezone(NEW_YORK).date()
    if is_trading_day(day) and session_close_utc(day, close) <= now:
        return day
    return previous_trading_day(day)
