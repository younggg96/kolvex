"""
Stock Data Tools
封装 YFinance 和 Finnhub 服务为 LangGraph 工具
"""

import json
import asyncio
import logging
import math
from typing import Literal, Optional
from langchain_core.tools import tool
from pydantic import ValidationError

from app.agent.revenue_evidence import RevenueComparison, RevenueEvidence
from app.services.sec.client import SecNotFound, SecUnavailable, sec_client

from app.services.yfinance.client import get_yfinance_service
from app.services.finnhub.client import get_finnhub_client

logger = logging.getLogger(__name__)


@tool
def get_stock_quote(symbol: str) -> str:
    """Get real-time stock quote including current price, change, volume, and market cap.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)

    Returns:
        JSON string with stock quote data
    """
    try:
        yf_service = get_yfinance_service()
        quote = yf_service.get_quote(symbol)

        # 清理 None 值并格式化
        result = {k: v for k, v in quote.items() if v is not None}
        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error getting stock quote for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get quote for {symbol}: {str(e)}"})


@tool
def get_stock_financials(symbol: str) -> str:
    """Get stock financial data including PE ratio, profit margins, revenue, earnings, debt ratios, and cash flow metrics.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)

    Returns:
        JSON string with financial data
    """
    try:
        yf_service = get_yfinance_service()
        financials = yf_service.get_financials(symbol)

        result = {k: v for k, v in financials.items() if v is not None}
        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error getting financials for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get financials for {symbol}: {str(e)}"})


def _sec_revenue(history: dict, period: str) -> list[RevenueEvidence]:
    facts = []
    for row in history[period]:
        source = row["sources"].get("revenue")
        if not source or source.get("derived") is not False:
            continue
        try:
            facts.append(RevenueEvidence(
                symbol=history["symbol"], value=row["revenue"], currency=history["currency"],
                period_kind=period, period_start=row["start"], period_end=row["period"],
                filed_on=source["filed"], source_url=source["source_url"],
            ))
        except ValidationError:
            continue
    return facts


def _yahoo_revenue(symbol: str, period: str) -> list[RevenueEvidence]:
    """Yahoo's reported income statement, newest first, in the company's financial currency."""
    ticker = get_yfinance_service().get_ticker(symbol)
    frame = ticker.quarterly_income_stmt if period == "quarterly" else ticker.income_stmt
    currency = (ticker.info or {}).get("financialCurrency")
    if frame is None or frame.empty or "Total Revenue" not in frame.index or not currency:
        return []
    symbol = symbol.upper()
    facts = []
    for end, value in frame.loc["Total Revenue"].items():
        if value is None or not math.isfinite(float(value)):
            continue  # Yahoo pads older columns with NaN
        try:
            facts.append(RevenueEvidence(
                symbol=symbol, value=float(value), currency=currency, period_kind=period,
                period_end=end.date(), source="yahoo",
                source_url=f"https://finance.yahoo.com/quote/{symbol}/financials/",
            ))
        except (ValidationError, AttributeError):
            continue
    return sorted(facts, key=lambda f: f.period_end, reverse=True)


def _comparable(latest: RevenueEvidence, prior: RevenueEvidence) -> bool:
    # Fiscal weeks can move period boundaries by up to a week from year to year.
    gaps = [(latest.period_end - prior.period_end).days]
    if latest.period_start and prior.period_start:
        gaps.append((latest.period_start - prior.period_start).days)
    return all(358 <= gap <= 373 for gap in gaps)


@tool
async def get_reported_revenue(
    symbol: str,
    period: Literal["quarterly", "annual"] = "quarterly",
    year_over_year: bool = False,
) -> str:
    """Get up to two latest directly reported quarterly or annual revenue figures.
    Uses SEC EDGAR (10-K/10-Q) with the filing date and original filing link. When SEC has no
    directly reported period, e.g. foreign companies filing 20-F/6-K such as TSM, falls back to
    Yahoo Finance's reported income statement, in the company's reporting currency (source "yahoo").
    Derived quarters and TTM are excluded. Use annual only when the user asks for full-year revenue.
    Set year_over_year to true to compare the latest directly reported period with the same
    period a year earlier and return a server-calculated percentage, if comparable data exists.
    """
    facts: list[RevenueEvidence] = []
    try:
        facts = _sec_revenue(await sec_client.financials(symbol), period)
    except (SecNotFound, SecUnavailable):
        pass
    if not facts:
        try:
            facts = await asyncio.to_thread(_yahoo_revenue, symbol, period)
        except Exception as error:  # noqa: BLE001
            logger.warning(f"Yahoo revenue fallback failed for {symbol}: {error}")

    evidence: list[RevenueEvidence] = []
    for fact in facts:
        if year_over_year and evidence and not _comparable(evidence[0], fact):
            continue
        evidence.append(fact)
        if len(evidence) == 2:
            break

    if not evidence:
        return json.dumps({"error": "No directly reported revenue for this period from SEC or Yahoo Finance"})
    if not year_over_year:
        return json.dumps([fact.model_dump(mode="json", exclude_none=True) for fact in evidence])

    growth = None
    reason = "No comparable directly reported period a year earlier."
    if len(evidence) == 2:
        latest, prior = evidence
        reason = "Percentage growth requires a positive, comparable prior-period revenue."
        if prior.value > 0:
            change = (latest.value / prior.value - 1) * 100
            if math.isfinite(change):
                growth, reason = round(change, 2), None
    comparison = RevenueComparison(evidence=evidence, year_over_year_pct=growth, unavailable_reason=reason)
    # Facts omit their optional comparison fields; the comparison lives at the top level only.
    return json.dumps({
        "evidence": [fact.model_dump(mode="json", exclude_none=True) for fact in comparison.evidence],
        "year_over_year_pct": comparison.year_over_year_pct,
        "unavailable_reason": comparison.unavailable_reason,
    })


@tool
def get_analyst_recommendations(symbol: str) -> str:
    """Get analyst ratings, target prices, and recommendation history for a stock.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)

    Returns:
        JSON string with analyst recommendation data
    """
    try:
        yf_service = get_yfinance_service()
        recs = yf_service.get_analyst_recommendations(symbol)

        result = {k: v for k, v in recs.items() if v is not None}
        # 限制推荐历史数量避免太长
        if "recommendations" in result:
            result["recommendations"] = result["recommendations"][:10]
        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error getting analyst recommendations for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get recommendations for {symbol}: {str(e)}"})


@tool
def get_stock_history(symbol: str, period: str = "1mo", interval: str = "1d") -> str:
    """Get historical stock price data for charting and analysis.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)
        period: Time period - one of: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, ytd, max
        interval: Data interval - one of: 1d, 5d, 1wk, 1mo

    Returns:
        JSON string with historical price data (date, open, high, low, close, volume)
    """
    try:
        yf_service = get_yfinance_service()
        history = yf_service.get_history(symbol, period=period, interval=interval)

        # 限制数据量
        if len(history) > 60:
            history = history[-60:]

        return json.dumps(
            {"symbol": symbol.upper(), "period": period, "interval": interval, "data": history},
            indent=2,
            default=str,
        )
    except Exception as e:
        logger.error(f"Error getting stock history for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get history for {symbol}: {str(e)}"})


@tool
def get_company_info(symbol: str) -> str:
    """Get company profile including sector, industry, business summary, and employee count.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, NVDA)

    Returns:
        JSON string with company information
    """
    try:
        yf_service = get_yfinance_service()
        info = yf_service.get_company_info(symbol)

        result = {k: v for k, v in info.items() if v is not None}
        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error getting company info for {symbol}: {e}")
        return json.dumps({"error": f"Failed to get company info for {symbol}: {str(e)}"})
