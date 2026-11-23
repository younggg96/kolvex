"""Source adapters: fetch and parse daily index history from Cboe and FRED.

Parsers are pure and keep every row they can read; trading-day and range checks
happen in ``quality``. A malformed file raises ``SourceFormatError`` so a changed
provider format never silently becomes an empty or partial series.
"""

import csv
import io
import math
from dataclasses import dataclass
from datetime import date, datetime

import httpx

from app.services.market_risk.metrics import CBOE_HISTORY_URL

FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
TIMEOUT = httpx.Timeout(30.0, connect=10.0)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; market-data-client/1.0)"}


class SourceFormatError(ValueError):
    pass


@dataclass(frozen=True)
class RawPoint:
    trading_date: date
    value: float | None  # None when the provider row is blank or unreadable
    line: int


def _decode(content: bytes) -> str:
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise SourceFormatError("encoding") from exc


def _number(raw: str) -> float | None:
    raw = raw.strip()
    if raw in ("", "."):
        return None
    try:
        value = float(raw)
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def parse_cboe_history(content: bytes, symbol: str) -> list[RawPoint]:
    """Cboe ``DATE,OPEN,HIGH,LOW,CLOSE`` (or ``DATE,<SYMBOL>``) with MM/DD/YYYY dates."""
    reader = csv.reader(io.StringIO(_decode(content), newline=""))
    header = [cell.strip().upper() for cell in next(reader, [])]
    if header[:1] != ["DATE"]:
        raise SourceFormatError(f"{symbol}: unexpected header {header[:5]}")
    if "CLOSE" in header:
        column = header.index("CLOSE")
    elif symbol.upper() in header:
        column = header.index(symbol.upper())
    else:
        raise SourceFormatError(f"{symbol}: no close column in {header[:5]}")

    points = []
    for cells in reader:
        if not cells or not any(cell.strip() for cell in cells):
            continue
        try:
            day = datetime.strptime(cells[0].strip(), "%m/%d/%Y").date()
        except ValueError as exc:
            raise SourceFormatError(f"{symbol}: bad date on line {reader.line_num}") from exc
        value = _number(cells[column]) if len(cells) > column else None
        points.append(RawPoint(day, value, reader.line_num))
    if not points:
        raise SourceFormatError(f"{symbol}: no rows")
    return points


def parse_fred_series(content: bytes, series_id: str) -> list[RawPoint]:
    """FRED ``observation_date,<SERIES>`` CSV; blank values mark days without data."""
    reader = csv.reader(io.StringIO(_decode(content), newline=""))
    header = [cell.strip() for cell in next(reader, [])]
    if len(header) != 2 or header[1].upper() != series_id.upper():
        raise SourceFormatError(f"{series_id}: unexpected header {header}")
    points = []
    for cells in reader:
        if not cells or not cells[0].strip():
            continue
        try:
            day = date.fromisoformat(cells[0].strip())
        except ValueError as exc:
            raise SourceFormatError(f"{series_id}: bad date on line {reader.line_num}") from exc
        points.append(RawPoint(day, _number(cells[1]) if len(cells) > 1 else None, reader.line_num))
    if not points:
        raise SourceFormatError(f"{series_id}: no rows")
    return points


async def _get(client: httpx.AsyncClient, url: str, headers: dict | None = None) -> bytes:
    response = await client.get(url, headers=headers, follow_redirects=True)
    response.raise_for_status()
    return response.content


async def fetch_cboe_history(client: httpx.AsyncClient, symbol: str) -> list[RawPoint]:
    url = CBOE_HISTORY_URL.format(symbol=symbol)
    return parse_cboe_history(await _get(client, url, HEADERS), symbol)


async def fetch_fred_series(client: httpx.AsyncClient, series_id: str) -> list[RawPoint]:
    return parse_fred_series(
        await _get(client, FRED_CSV_URL.format(series_id=series_id)), series_id
    )
