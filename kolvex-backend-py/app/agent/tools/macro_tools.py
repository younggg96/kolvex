"""Macro tool: the same government indicator snapshot the Macro tab shows (FRED: BLS, BEA, Fed)."""

import json
import logging
from typing import Optional

from langchain_core.tools import tool

from app.services.economic_indicators import economic_indicators_service

logger = logging.getLogger(__name__)

RECENT_POINTS = 6


def macro_payload(snapshot: dict, indicators: Optional[list[str]] = None) -> dict:
    wanted = {i.strip().lower() for i in indicators or [] if i and i.strip()}
    items = [
        item for item in snapshot.get("indicators") or []
        if not wanted or item.get("id") in wanted
    ]  # fmt: skip
    payload = {
        "status": snapshot.get("status"),
        "fetched_at": snapshot.get("fetched_at"),
        "indicators": [
            {
                "id": item.get("id"),
                "name_zh": item.get("name_zh"),
                "name_en": item.get("name_en"),
                "status": item.get("status"),
                "value": item.get("value"),
                "unit": item.get("unit"),
                "period": item.get("period"),
                "previous_value": item.get("previous_value"),
                "previous_period": item.get("previous_period"),
                "change": item.get("change"),
                "change_unit": item.get("change_unit"),
                "frequency": item.get("frequency"),
                "source": item.get("source"),
                "source_url": item.get("source_url"),
                "recent": (item.get("history") or [])[-RECENT_POINTS:],
            }
            for item in items
        ],
    }
    if not any(i["value"] is not None for i in payload["indicators"]):
        payload["gap"] = (
            "unavailable" if snapshot.get("status") in ("pending", "unavailable") else "no_data"
        )
    return payload


@tool
async def get_macro_indicators(indicators: Optional[list[str]] = None) -> str:
    """Latest US macro indicators from government sources: Treasury yields, CPI, jobs and GDP.

    Each indicator has its value, the period it covers, the previous reading, the change and the
    source link. Ids: us2y, us10y, us30y, spread (10Y-2Y), cpi, core_cpi (YoY), unemployment,
    payrolls (monthly change, thousands), gdp (annualized QoQ). An indicator with status "stale"
    has not been refreshed on schedule: say so. Name the period, not today, as the data's date.

    Args:
        indicators: Optional list of ids to return; all indicators when omitted.
    """
    try:
        snapshot = await economic_indicators_service.get_snapshot()
        payload = macro_payload(snapshot, indicators)
    except Exception as error:  # noqa: BLE001
        logger.warning("get_macro_indicators failed: %s", error)
        payload = {"gap": "unavailable", "error": "macro indicators unavailable"}
    return json.dumps(payload, ensure_ascii=False, default=str)
