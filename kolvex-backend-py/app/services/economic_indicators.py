"""Free government economic statistics from FRED public CSV exports.

Only the allowlisted Federal Reserve/BLS/BEA public-domain series are consumed.
Observation periods are distinct from the time at which we retrieved the data.
"""

import asyncio
import calendar
from copy import deepcopy
import csv
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import io
import logging
import math
from uuid import uuid4
import zipfile

import httpx

from app.core.redis import get_redis

logger = logging.getLogger(__name__)
UTC = timezone.utc
CACHE_KEY = "macro:government:v1"
LEASE_KEY = "macro:government:refresh"
REFRESH_HOURS = 6
FRED_IDS = ("DGS2", "DGS10", "CPIAUCNS", "CPILFENS", "UNRATE", "PAYEMS", "A191RL1Q225SBEA")


@dataclass(frozen=True)
class Indicator:
    key: str
    name_en: str
    name_zh: str
    group: str
    frequency: str
    unit: str
    change_unit: str
    source: str
    source_url: str
    series_id: str
    method: str = "level"


INDICATORS = (
    Indicator("us2y", "2-year Treasury yield", "2年美债收益率", "rates", "daily", "percent", "bp", "Federal Reserve via FRED", "https://fred.stlouisfed.org/series/DGS2", "DGS2"),
    Indicator("us10y", "10-year Treasury yield", "10年美债收益率", "rates", "daily", "percent", "bp", "Federal Reserve via FRED", "https://fred.stlouisfed.org/series/DGS10", "DGS10"),
    Indicator("spread", "10Y − 2Y yield spread", "10年－2年美债利差", "rates", "daily", "pp", "bp", "Federal Reserve via FRED", "https://fred.stlouisfed.org/series/T10Y2Y", "DGS10 − DGS2", "spread"),
    Indicator("cpi", "CPI inflation, YoY", "CPI 同比", "inflation", "monthly", "percent", "pp", "BLS via FRED", "https://fred.stlouisfed.org/series/CPIAUCNS", "CPIAUCNS", "yoy"),
    Indicator("core_cpi", "Core CPI inflation, YoY", "核心 CPI 同比", "inflation", "monthly", "percent", "pp", "BLS via FRED", "https://fred.stlouisfed.org/series/CPILFENS", "CPILFENS", "yoy"),
    Indicator("unemployment", "Unemployment rate", "失业率", "employment", "monthly", "percent", "pp", "BLS via FRED", "https://fred.stlouisfed.org/series/UNRATE", "UNRATE"),
    Indicator("payrolls", "Nonfarm payrolls, monthly change", "非农新增就业", "employment", "monthly", "thousands", "thousands", "BLS via FRED", "https://fred.stlouisfed.org/series/PAYEMS", "PAYEMS", "monthly_change"),
    Indicator("gdp", "Real GDP growth, annualized QoQ", "实际 GDP 季环比年化", "growth", "quarterly", "percent", "pp", "BEA via FRED", "https://fred.stlouisfed.org/series/A191RL1Q225SBEA", "A191RL1Q225SBEA"),
)


def finite(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def parse_fred(content: bytes, cutoff: date, start: date) -> dict:
    """Mixed-frequency FRED downloads can be a ZIP of monthly/quarterly CSVs."""
    if len(content) > 8_000_000:
        raise ValueError("fred_export_too_large")
    if content.startswith(b"PK"):
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            files = [item for item in archive.infolist() if item.filename.lower().endswith(".csv")]
            if not files or sum(item.file_size for item in files) > 16_000_000:
                raise ValueError("fred_export_invalid")
            texts = [archive.read(item).decode("utf-8-sig") for item in files]
    else:
        texts = [content.decode("utf-8-sig")]
    series = {key: {} for key in FRED_IDS}
    for text in texts:
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames or not ({"observation_date", "DATE"} & set(reader.fieldnames)):
            raise ValueError("fred_export_invalid")
        for row in reader:
            try:
                day = date.fromisoformat(row.get("observation_date") or row.get("DATE") or "")
            except ValueError:
                continue
            if not start <= day <= cutoff:
                continue
            for key in series:
                value = finite(row.get(key))
                if value is not None:
                    series[key][day] = value
    return series


def previous_month(day: date) -> date:
    return (day.replace(day=1) - timedelta(days=1)).replace(day=1)


def transform(item: Indicator, raw: dict[date, float], series: dict) -> dict[date, float]:
    if item.method == "spread":
        short = series.get("DGS2", {})
        long = series.get("DGS10", {})
        return {day: long[day] - short[day] for day in long.keys() & short.keys()}
    if item.method == "yoy":
        return {day: (value / raw[date(day.year - 1, day.month, 1)] - 1) * 100
                for day, value in raw.items()
                if date(day.year - 1, day.month, 1) in raw and raw[date(day.year - 1, day.month, 1)] > 0}
    if item.method == "monthly_change":
        return {day: value - raw[previous_month(day)] for day, value in raw.items() if previous_month(day) in raw}
    return raw


def build_indicator(item: Indicator, series: dict, now: datetime) -> dict:
    raw = series.get(item.series_id, {})
    values = transform(item, raw, series)
    points = sorted(values.items())
    latest = points[-1] if points else None
    previous = points[-2] if len(points) > 1 else None
    # Don't compare across a missing monthly/quarterly release.
    if latest and previous:
        gap = (latest[0] - previous[0]).days
        if gap > {"daily": 10, "monthly": 35, "quarterly": 100}[item.frequency]:
            previous = None
    change = latest[1] - previous[1] if latest and previous else None
    if change is not None and item.change_unit == "bp":
        change *= 100
    status = "ready" if latest else "unavailable"
    if latest:
        period_end = latest[0]
        if item.frequency == "monthly":
            period_end = date(period_end.year, period_end.month, calendar.monthrange(period_end.year, period_end.month)[1])
        elif item.frequency == "quarterly":
            last_month = (period_end.month - 1) // 3 * 3 + 3
            period_end = date(period_end.year, last_month, calendar.monthrange(period_end.year, last_month)[1])
        if (now.date() - period_end).days > {"daily": 10, "monthly": 60, "quarterly": 150}[item.frequency]:
            status = "stale"
        if raw and max(raw) > latest[0]:
            status = "stale"
    return {
        "id": item.key, "name_en": item.name_en, "name_zh": item.name_zh,
        "group": item.group, "frequency": item.frequency, "unit": item.unit,
        "change_unit": item.change_unit, "source": item.source, "source_url": item.source_url,
        "series_id": item.series_id, "method": item.method, "status": status,
        "value": round(latest[1], 4) if latest else None,
        "period": latest[0].isoformat() if latest else None,
        "previous_value": round(previous[1], 4) if previous else None,
        "previous_period": previous[0].isoformat() if previous else None,
        "change": round(change, 4) if change is not None else None,
        "history": [{"date": day.isoformat(), "value": round(value, 4)} for day, value in points[-2000:]],
    }


class EconomicIndicatorsService:
    def __init__(self):
        self._snapshot = None
        self._lock = asyncio.Lock()

    async def _stored(self):
        return await get_redis().get_json(CACHE_KEY) or self._snapshot

    async def get_snapshot(self, now: datetime | None = None):
        now = now or datetime.now(UTC)
        await self.refresh(now)
        snapshot = deepcopy(await self._stored())
        if not snapshot:
            snapshot = {"status": "pending", "fetched_at": None, "retry_at": None,
                        "refresh_hours": REFRESH_HOURS, "indicators": [build_indicator(item, {}, now) for item in INDICATORS]}
        if snapshot["fetched_at"] and now - datetime.fromisoformat(snapshot["fetched_at"]) > timedelta(hours=REFRESH_HOURS + 1):
            snapshot["status"] = "stale"
            for item in snapshot["indicators"]:
                if item["value"] is not None:
                    item["status"] = "stale"
        return snapshot

    async def refresh(self, now: datetime | None = None):
        now = now or datetime.now(UTC)
        async with self._lock:
            stored = await self._stored()
            if stored and now < datetime.fromisoformat(stored["retry_at"]):
                return
            redis = get_redis()
            token = str(uuid4())
            if redis.is_connected and not await redis.acquire_lock(LEASE_KEY, token, ttl=90):
                return
            try:
                latest = await self._stored()
                if latest and now < datetime.fromisoformat(latest["retry_at"]):
                    return
                await asyncio.wait_for(self._collect(now, latest or stored), timeout=35)
            except Exception:
                logger.warning("Government macro refresh failed")
                # Bound retries even when the whole collection times out.
                fallback = deepcopy(stored) if stored else {"status": "unavailable", "fetched_at": now.isoformat(), "refresh_hours": REFRESH_HOURS,
                                                           "indicators": [build_indicator(item, {}, now) for item in INDICATORS]}
                fallback["status"] = "stale" if any(item["value"] is not None for item in fallback["indicators"]) else "unavailable"
                for item in fallback["indicators"]:
                    if item["value"] is not None:
                        item["status"] = "stale"
                fallback["retry_at"] = (now + timedelta(hours=1)).isoformat()
                self._snapshot = fallback
                await redis.set_json(CACHE_KEY, fallback, ttl=86400 * 30)
            finally:
                if redis.is_connected:
                    await redis.release_lock(LEASE_KEY, token)

    async def _collect(self, now: datetime, previous: dict | None):
        cutoff = now.date()
        start = date(cutoff.year - 6, 1, 1)
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            try:
                response = await client.get("https://fred.stlouisfed.org/graph/fredgraph.csv", params={"id": ",".join(FRED_IDS), "cosd": start.isoformat()})
                response.raise_for_status()
                series = parse_fred(response.content, cutoff, start)
            except Exception:
                logger.warning("FRED government-series export unavailable")
                series = {}
        old = {item["id"]: item for item in (previous or {}).get("indicators", [])}
        indicators = []
        for spec in INDICATORS:
            item = build_indicator(spec, series, now)
            previous_item = old.get(spec.key)
            if previous_item and previous_item["value"] is not None and (item["value"] is None or item["period"] < previous_item["period"]):
                item = deepcopy(previous_item)
                item["status"] = "stale"
            indicators.append(item)
        complete = all(item["status"] == "ready" for item in indicators)
        snapshot = {
            "status": "ready" if complete else "partial" if any(item["value"] is not None for item in indicators) else "unavailable",
            "fetched_at": now.isoformat(), "refresh_hours": REFRESH_HOURS,
            "retry_at": (now + timedelta(hours=REFRESH_HOURS if complete else 1)).isoformat(),
            "indicators": indicators,
        }
        self._snapshot = snapshot
        await get_redis().set_json(CACHE_KEY, snapshot, ttl=86400 * 30)


economic_indicators_service = EconomicIndicatorsService()


async def run_economic_indicators_worker():
    while True:
        try:
            await economic_indicators_service.refresh()
        except Exception:
            logger.warning("Government macro worker check failed")
        await asyncio.sleep(60)
