"""Storage and validation for CNN Fear & Greed observations (admin CSV or local worker)."""

import csv
import io
import math
import re
from datetime import date, datetime, time, timezone
from decimal import Decimal, InvalidOperation
from typing import Literal, get_args
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from app.services.market_risk.calendar import is_trading_day
from supabase import Client

TABLE = "fear_greed_observations"
MAX_BYTES = 512 * 1024
MAX_ROWS = 10_000
HISTORY_COUNT = 90
NEW_YORK = ZoneInfo("America/New_York")
MARKET_OPEN = time(9, 30)
Rating = Literal["extreme fear", "fear", "neutral", "greed", "extreme greed"]


class Observation(BaseModel):
    date: date
    score: float = Field(ge=0, le=100)
    rating: Rating | None


class InvalidCsv(ValueError):
    def __init__(self, code: str, line: int | None = None):
        self.code = code
        self.line = line
        super().__init__(code)


def parse_csv(payload: bytes, today: date) -> list[Observation]:
    try:
        source = payload.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise InvalidCsv("encoding") from exc

    reader = csv.reader(io.StringIO(source, newline=""), strict=True)
    observations: dict[date, Observation] = {}
    try:
        columns = [value.strip().lower() for value in next(reader, [])]
        if columns not in (["date", "score"], ["date", "score", "rating"]):
            raise InvalidCsv("header", 1)
        for cells in reader:
            if not cells or (len(cells) == 1 and not cells[0].strip()):
                continue
            line = reader.line_num
            if len(observations) >= MAX_ROWS:
                raise InvalidCsv("too_many_rows")
            if len(cells) != len(columns):
                raise InvalidCsv("columns", line)

            raw_date, raw_score, *optional = [cell.strip() for cell in cells]
            try:
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
                    raise ValueError("Expected YYYY-MM-DD")
                day = date.fromisoformat(raw_date)
                if day > today:
                    raise ValueError("Future date")
            except ValueError as exc:
                raise InvalidCsv("date", line) from exc
            if day in observations:
                raise InvalidCsv("duplicate", line)
            try:
                score = Decimal(raw_score)
                if not score.is_finite() or not 0 <= score <= 100:
                    raise ValueError("Score out of range")
            except (InvalidOperation, ValueError) as exc:
                raise InvalidCsv("score", line) from exc
            rating = " ".join(optional[0].lower().split()) if optional else ""
            if rating and rating not in get_args(Rating):
                raise InvalidCsv("rating", line)
            observations[day] = Observation(date=day, score=float(score), rating=rating or None)
    except csv.Error as exc:
        raise InvalidCsv("csv", reader.line_num) from exc

    if not observations:
        raise InvalidCsv("empty")
    return [observations[day] for day in sorted(observations)]


class InvalidCnnData(ValueError):
    """The worker's CNN chart payload is not in the expected shape; nothing is saved."""


def _cnn_rating(value: object) -> Rating | None:
    rating = " ".join(str(value or "").lower().split())
    return rating if rating in get_args(Rating) else None


def _cnn_score(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise InvalidCnnData("score")
    score = float(value)
    if not math.isfinite(score) or not 0 <= score <= 100:
        raise InvalidCnnData("score")
    return round(score, 4)


def _cnn_point_date(moment: datetime) -> date:
    # CNN stamps finished days at 00:00 UTC (that UTC date is the trading day); the live
    # reading carries its real time, which belongs to the New York trading day.
    utc = moment.astimezone(timezone.utc)
    return utc.date() if utc.time() == time(0) else utc.astimezone(NEW_YORK).date()


def parse_cnn_graph(payload: object, now: datetime) -> list[Observation]:
    """Turn CNN's ``fearandgreed/graphdata`` JSON into one observation per NYSE session.

    The current reading wins over the historical point of the same day. CNN opens the next
    day's point after the close, carrying the last value until trading starts, so days
    that are not sessions (weekends, holidays) and today before 09:30 New York time are
    dropped, as are future days. Any malformed point rejects the whole payload so a
    format change never writes half-parsed data.
    """
    if not isinstance(payload, dict):
        raise InvalidCnnData("shape")
    current = payload.get("fear_and_greed")
    history = payload.get("fear_and_greed_historical")
    points = history.get("data") if isinstance(history, dict) else None
    if not isinstance(current, dict) or not isinstance(points, list):
        raise InvalidCnnData("shape")

    days: dict[date, Observation] = {}
    for point in points:
        if not isinstance(point, dict):
            raise InvalidCnnData("point")
        stamp = point.get("x")
        if (
            isinstance(stamp, bool)
            or not isinstance(stamp, (int, float))
            or not math.isfinite(stamp)
        ):
            raise InvalidCnnData("date")
        try:
            day = _cnn_point_date(datetime.fromtimestamp(stamp / 1000, timezone.utc))
        except (OverflowError, OSError, ValueError) as exc:
            raise InvalidCnnData("date") from exc
        days[day] = Observation(
            date=day, score=_cnn_score(point.get("y")), rating=_cnn_rating(point.get("rating"))
        )

    try:
        moment = datetime.fromisoformat(str(current.get("timestamp")))
    except ValueError as exc:
        raise InvalidCnnData("date") from exc
    if moment.tzinfo is None:
        raise InvalidCnnData("date")
    day = _cnn_point_date(moment)
    days[day] = Observation(
        date=day, score=_cnn_score(current.get("score")), rating=_cnn_rating(current.get("rating"))
    )

    local = now.astimezone(NEW_YORK)
    today = local.date()
    started = local.time() >= MARKET_OPEN

    def observed(day: date) -> bool:
        return is_trading_day(day) and (day < today or (day == today and started))

    rows = [days[day] for day in sorted(days) if observed(day)]
    if not rows:
        raise InvalidCnnData("empty")
    return rows


def save_observations(db: Client, rows: list[Observation], admin_id: str | None) -> None:
    """Upsert by date. ``admin_id`` is None for rows written by the automatic worker."""
    now = datetime.now(timezone.utc).isoformat()
    records = [
        {**row.model_dump(mode="json"), "updated_by": admin_id, "updated_at": now} for row in rows
    ]
    db.table(TABLE).upsert(records, on_conflict="date", returning="minimal").execute()


def list_observations(db: Client) -> list[dict]:
    rows = (
        db.table(TABLE)
        .select("date,score,rating")
        .order("date", desc=True)
        .limit(HISTORY_COUNT)
        .execute()
        .data
    )
    return list(reversed(rows))


def latest_status(db: Client) -> dict | None:
    """The newest stored day and who wrote it, for the admin page."""
    rows = (
        db.table(TABLE)
        .select("date,score,updated_by,updated_at")
        .order("date", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return None
    row = rows[0]
    return {
        "date": row["date"],
        "score": row["score"],
        "updated_at": row["updated_at"],
        "source": "worker" if row.get("updated_by") is None else "admin",
    }
