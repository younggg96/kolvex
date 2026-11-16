"""Valuation tool: the stock page's PE valuation (SEC EPS, own five-year PE percentiles)."""

import asyncio
import json
import logging

from langchain_core.tools import tool

from app.services.valuation.service import valuation_service

logger = logging.getLogger(__name__)

BUILD_WAIT_SECONDS = 25
HISTORY_POINTS = 250  # about one year of sessions, for the PE range the user sees


def _round(value, digits=2):
    return round(value, digits) if isinstance(value, (int, float)) else value


def valuation_payload(data: dict) -> dict:
    current = data.get("current") or {}
    calibration = current.get("calibration") or {}
    reference = current.get("reference") or {}
    scenarios = {
        name: {
            "target_pe": _round(s.get("target_pe")),
            "reference_value": _round(s.get("reference_value")),
            # Price versus this reference value: +10 means the price is 10% above it.
            "premium_discount_pct": _round(
                ((s.get("comparison") or {}).get("premium_discount") or 0) * 100
            )
            if s.get("comparison")
            else None,
        }
        for name, s in (reference.get("scenarios") or {}).items()
    }
    pes = [p["pe"] for p in (data.get("points") or [])[-HISTORY_POINTS:] if p.get("pe")]
    payload = {
        "symbol": data.get("symbol"),
        "as_of": data.get("as_of"),
        "price": _round(current.get("price")),
        "price_date": current.get("price_date"),
        "price_kind": data.get("price_kind"),
        "ttm_diluted_eps": _round(current.get("eps"), 4),
        "eps_period_end": current.get("period_end"),
        "eps_status": current.get("status"),
        "current_pe": _round(current.get("pe")),
        "pe_reference": {
            "method": "the company's own daily PE over the prior five years: P25 / P50 / P75 as "
            "conservative / base / optimistic",
            "status": calibration.get("status")
            or ("ready" if calibration.get("multiples") else None),
            "lookback_start": calibration.get("lookback_start"),
            "sample_count": calibration.get("sample_count"),
            # Share of the five-year daily PE samples below today's PE, 0-100.
            "current_pe_percentile_pct": _round(calibration["percentile"] * 100)
            if isinstance(calibration.get("percentile"), (int, float))
            else None,
        },
        "scenarios": scenarios or None,
        "past_year_pe_range": {"low": _round(min(pes)), "high": _round(max(pes))} if pes else None,
        "source": "SEC filings (diluted EPS) and regular-session closes",
    }
    if not scenarios:
        payload["note"] = "No reference range: not enough PE history or EPS inputs to calibrate."
    return payload


@tool
async def get_valuation(symbol: str) -> str:
    """The stock page's PE valuation: current PE on SEC trailing diluted EPS, where it sits in the
    company's own five-year PE range, and conservative / base / optimistic reference values.

    Reference values are model calculations from historical multiples, not price targets or fair
    values: say so, and give the price date and EPS period. Only a few companies are covered so far;
    an "unsupported" result lists them.

    Args:
        symbol: Stock ticker, e.g. "NVDA".
    """
    symbol = symbol.strip().upper()
    try:
        status, data = valuation_service.request(symbol)
        if status == 202:
            # The first request for a symbol builds it from SEC data; wait briefly for that build.
            job = valuation_service.jobs.get(data.get("job_id"), {})
            task = job.get("task")
            if task is not None:
                await asyncio.wait_for(asyncio.shield(task), timeout=BUILD_WAIT_SECONDS)
            status, data = valuation_service.request(symbol)
        if data.get("status") == "unsupported":
            payload = {
                "symbol": symbol,
                "gap": "no_data",
                "error": "valuation not covered for this stock yet",
                "supported_symbols": data.get("supported_symbols"),
            }
        elif status != 200 or "current" not in data:
            payload = {"symbol": symbol, "gap": "unavailable", "error": "valuation unavailable"}
        else:
            payload = valuation_payload(data)
    except asyncio.TimeoutError:
        payload = {
            "symbol": symbol,
            "gap": "unavailable",
            "error": "valuation is still being built; retry later",
        }
    except Exception as error:  # noqa: BLE001
        logger.warning("get_valuation failed for %s: %s", symbol, error)
        payload = {"symbol": symbol, "gap": "unavailable", "error": "valuation unavailable"}
    return json.dumps(payload, ensure_ascii=False, default=str)
