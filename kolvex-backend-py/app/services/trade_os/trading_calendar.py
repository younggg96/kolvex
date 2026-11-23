"""
US equity trading calendar for Trade OS (PRD §6.4, §18.3, §23).

Everything is interpreted in America/New_York on the NYSE (XNYS) calendar, so
holidays and early closes are handled instead of assuming 16:00 every weekday.
"""

from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from typing import Optional
from zoneinfo import ZoneInfo

import exchange_calendars
import pandas as pd

NEW_YORK = ZoneInfo("America/New_York")

# Daily bars are not final the second the bell rings; give providers time.
DATA_SETTLE_MINUTES = 45


@lru_cache(maxsize=1)
def _calendar():
    return exchange_calendars.get_calendar("XNYS")


def _ts(day: date) -> pd.Timestamp:
    return pd.Timestamp(day)


def last_completed_session(now: Optional[datetime] = None) -> date:
    """Most recent session whose close is at or before ``now``."""
    now = now or datetime.now(timezone.utc)
    cal = _calendar()
    session = cal.date_to_session(now.astimezone(NEW_YORK).date(), direction="previous")
    if now < cal.session_close(session):
        session = cal.previous_session(session)
    return session.date()


def session_close(day: date) -> datetime:
    return _calendar().session_close(_ts(day)).to_pydatetime()


def next_session(day: date) -> date:
    cal = _calendar()
    return cal.next_session(cal.date_to_session(_ts(day), direction="previous")).date()


def daily_job_session(now: Optional[datetime] = None) -> Optional[date]:
    """
    The session the after-close job should process right now, or None.
    Window: close + settle time until the next session opens.
    """
    now = now or datetime.now(timezone.utc)
    session = last_completed_session(now)
    cal = _calendar()
    close = cal.session_close(_ts(session))
    next_open = cal.session_open(cal.next_session(_ts(session)))
    if close + timedelta(minutes=DATA_SETTLE_MINUTES) <= now < next_open:
        return session
    return None


def sessions_after(start: date, end: date) -> int:
    """Trading sessions strictly after ``start`` up to and including ``end``."""
    if end <= start:
        return 0
    sessions = _calendar().sessions_in_range(_ts(start + timedelta(days=1)), _ts(end))
    return len(sessions)


def is_stale(bar_date: date, now: Optional[datetime] = None, allowed_lag: int = 1) -> bool:
    """
    A daily close is stale when more than ``allowed_lag`` completed sessions have
    passed since it. Lag 1 tolerates a provider that hasn't published today's bar yet.
    """
    return sessions_after(bar_date, last_completed_session(now)) > allowed_lag


def bar_session(bar: dict) -> Optional[date]:
    """New York date of a daily bar ('2026-11-20' or '2026-11-20T00:00:00-05:00')."""
    try:
        return date.fromisoformat(str(bar.get("date"))[:10])
    except ValueError:
        return None


def completed_bars(bars: list, now: Optional[datetime] = None) -> list:
    """
    Drops today's unfinished daily bar (and anything newer than the last completed
    session) so signals only use confirmed closes (PRD §6.4, §8.7).
    """
    cutoff = last_completed_session(now)
    return [b for b in bars if (bar_session(b) or cutoff) <= cutoff]
