"""Free research reads: SEC filings and the existing Yahoo provider only."""
import asyncio
from typing import Literal

from fastapi import APIRouter, HTTPException, Path
from app.services.sec.client import MANAGERS, SecNotFound, SecUnavailable, sec_client
from app.services.yfinance.client import get_yfinance_service
from app.services.sec.parsers import number

router = APIRouter(prefix="/market/free-research", tags=["Market Data"])


@router.get("/institutions")
async def managers():
    return {"managers": [{"id": key, **value} for key, value in MANAGERS.items()]}


@router.get("/institutions/{manager}")
async def institution(manager: str):
    if manager not in MANAGERS:
        raise HTTPException(404, "Manager is outside the tracked list")
    try:
        return await sec_client.institution(manager)
    except (SecUnavailable, ValueError, KeyError) as exc:
        raise HTTPException(503, "SEC holdings unavailable; retry later") from exc


def revenue_outlook(symbol):
    ticker = get_yfinance_service().get_ticker(symbol)
    frame = ticker.revenue_estimate
    info = ticker.info
    rows = []
    if frame is not None and not frame.empty:
        for period, row in frame.iterrows():
            rows.append({"period": str(period), "average": number(row.get("avg")), "low": number(row.get("low")),
                "high": number(row.get("high")), "analysts": number(row.get("numberOfAnalysts")),
                "year_ago": number(row.get("yearAgoRevenue")), "growth": number(row.get("growth"))})
    return {"symbol": symbol, "source": "Yahoo Finance", "currency": info.get("financialCurrency"),
        "estimates": rows, "historical_surprises": [],
        "coverage": "Current consensus periods only; historical revenue surprises are unavailable from this endpoint."}


@router.get("/{symbol}/{kind}")
async def company_research(
    symbol: str = Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9.\-]{0,11}$"),
    kind: Literal["financials", "filings", "insiders", "revenue-outlook"] = "financials",
):
    symbol = symbol.upper()
    try:
        if kind == "revenue-outlook":
            try:
                return await asyncio.to_thread(revenue_outlook, symbol)
            except Exception as exc:
                raise HTTPException(503, "Free revenue estimates unavailable") from exc
        return await getattr(sec_client, kind)(symbol)
    except SecNotFound as exc:
        raise HTTPException(404, "No SEC ticker mapping for this security") from exc
    except (SecUnavailable, ValueError, KeyError) as exc:
        raise HTTPException(503, "SEC data unavailable; retry later") from exc
