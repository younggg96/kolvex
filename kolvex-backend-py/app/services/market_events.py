"""Editorial market calendar contract. All calendar dates use New York time."""
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

MARKET_TZ = ZoneInfo("America/New_York")

class Event(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$")
    title: str = Field(min_length=1, max_length=200)
    title_en: str = Field(default="", max_length=200)
    category: Literal["earnings", "fed", "economic", "other"]
    event_date: date
    starts_at: datetime | None = None
    timing: Literal["scheduled", "before_open", "after_close", "all_day", "tbd"] = "tbd"
    importance: Literal["high", "medium", "low"] = "high"
    is_hot: bool = Field(default=False, strict=True)
    status: Literal["draft", "published", "cancelled"] = "draft"
    summary: str = Field(default="", max_length=4000)
    summary_en: str = Field(default="", max_length=4000)
    tickers: list[str] = Field(default_factory=list, max_length=30)
    source_name: str = Field(default="", max_length=200)
    source_url: HttpUrl | None = None

    @field_validator("tickers")
    @classmethod
    def symbols(cls, values):
        import re
        values = list(dict.fromkeys(v.strip().upper() for v in values))
        if any(not re.fullmatch(r"[A-Z0-9^][A-Z0-9.^=-]{0,19}", v) for v in values):
            raise ValueError("Invalid ticker")
        return values

    @field_validator("source_url")
    @classmethod
    def safe_url(cls, value):
        if value and (value.username or value.password):
            raise ValueError("Source URL must not contain credentials")
        return value

    @model_validator(mode="after")
    def schedule(self):
        if self.starts_at:
            if self.starts_at.utcoffset() is None:
                raise ValueError("starts_at requires an explicit UTC offset")
            if self.starts_at.astimezone(MARKET_TZ).date() != self.event_date:
                raise ValueError("event_date must match starts_at in America/New_York")
        if (self.timing == "scheduled") != (self.starts_at is not None):
            raise ValueError("Only scheduled events require starts_at; other timings must use null")
        return self

class Envelope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["kolvex-market-events/1.0"]
    timezone: Literal["America/New_York"]
    events: list[Event] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def unique_ids(self):
        if len({event.id for event in self.events}) != len(self.events):
            raise ValueError("Duplicate event IDs in one import")
        return self

def window(now: datetime | None = None):
    today = (now or datetime.now(MARKET_TZ)).astimezone(MARKET_TZ).date()
    monday = today - timedelta(days=today.weekday())
    return monday - timedelta(days=7), monday + timedelta(days=14), today

def list_events(db, *, admin=False, page=1, now=None):
    start, end, today = window(now)
    query = db.table("market_events").select("*", count="exact")
    if not admin:
        query = query.eq("status", "published").gte("event_date", start.isoformat()).lt("event_date", end.isoformat()).or_("importance.eq.high,is_hot.eq.true")
    result = query.order("event_date").order("id").range((page-1)*200, page*200-1).execute()
    rows = result.data or []
    # Public reads include the entire 21-day window, even when PostgREST caps responses.
    if not admin:
        offset = len(rows)
        while offset < (result.count or 0):
            chunk = query.order("event_date").order("id").range(offset, offset+199).execute().data or []
            if not chunk:
                raise RuntimeError("Incomplete calendar result")
            rows.extend(chunk)
            offset += len(chunk)
    return {"schema_version": "kolvex-market-events/1.0", "timezone": "America/New_York", "today": today.isoformat(), "start_date": start.isoformat(), "end_date_exclusive": end.isoformat(), "events": [row["payload"] for row in rows], "total": result.count or 0, "page": page}

def save_events(db, document, admin_id):
    rows = [{"id": event["id"], "event_date": event["event_date"], "status": event["status"], "importance": event["importance"], "is_hot": event["is_hot"], "payload": event, "updated_by": admin_id, "updated_at": datetime.now(ZoneInfo("UTC")).isoformat()} for event in document["events"]]
    db.table("market_events").upsert(rows, on_conflict="id").execute()
    return {"saved": len(rows)}
