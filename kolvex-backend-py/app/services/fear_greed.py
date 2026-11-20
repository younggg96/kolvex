"""Storage and CSV validation for manually provided CNN Fear & Greed observations."""

import csv
import io
import re
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Literal, get_args
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from supabase import Client

TABLE = "fear_greed_observations"
MAX_BYTES = 512 * 1024
MAX_ROWS = 10_000
HISTORY_COUNT = 90
NEW_YORK = ZoneInfo("America/New_York")
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


def save_observations(db: Client, rows: list[Observation], admin_id: str) -> None:
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
