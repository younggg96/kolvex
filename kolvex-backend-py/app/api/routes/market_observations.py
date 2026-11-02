"""Public daily FRED series already exposed by the Web client; fixed allowlist."""
import asyncio
import csv
import io
import math
import time
from datetime import date, timedelta
from typing import Literal
import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/market/observations", tags=["Market Data"])
SERIES = ("DGS2", "DGS10", "BAMLH0A0HYM2")
_cache = {}
_locks = {series: asyncio.Lock() for series in SERIES}

def observations(text, series):
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    if not reader.fieldnames or series not in reader.fieldnames or not ({"DATE", "observation_date"} & set(reader.fieldnames)):
        raise ValueError("Invalid series export")
    points = {}
    for row in reader:
        try:
            day = row.get("observation_date", row.get("DATE"))
            if date.fromisoformat(day).isoformat() != day:
                continue
            raw = row[series].strip()
            if not raw or raw == ".":
                continue
            value = float(raw)
            if math.isfinite(value):
                points[day] = value
        except (TypeError, ValueError, KeyError, AttributeError):
            continue
    if not points:
        raise ValueError("Empty series export")
    return [{"date": day, "value": value} for day, value in sorted(points.items())]

@router.get("/{series}")
async def daily_observations(series: Literal["DGS2", "DGS10", "BAMLH0A0HYM2"]):
    async with _locks[series]:
        cached = _cache.get(series)
        if cached and time.monotonic() - cached[0] < 21600:
            return cached[1]
        try:
            end = date.today()
            async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
                async with client.stream("GET", "https://fred.stlouisfed.org/graph/fredgraph.csv", params={"id":series,"cosd":(end-timedelta(days=740)).isoformat(),"coed":end.isoformat()}) as response:
                    response.raise_for_status()
                    chunks, size = [], 0
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > 2_000_000:
                            raise ValueError("Export too large")
                        chunks.append(chunk)
            result = {"series":series,"history":observations(b"".join(chunks).decode("utf-8-sig"),series),"source":"FRED","sourceUrl":f"https://fred.stlouisfed.org/series/{series}"}
            _cache[series] = (time.monotonic(), result)
            return result
        except (httpx.HTTPError, ValueError, UnicodeError) as exc:
            raise HTTPException(503, "Daily observations unavailable") from exc
