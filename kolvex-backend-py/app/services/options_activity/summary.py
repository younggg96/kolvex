"""Bilingual key-points summary of one options-activity run.

Generated once per run with the server's fast model and shared by every user.
If the model is unavailable, a deterministic template keeps the run usable.
"""

import asyncio
import json
import logging
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.services.technical_analysis import STRUCTURED_METHODS, _is_auth_error, _is_unsupported

logger = logging.getLogger(__name__)
PROMPT_VERSION = "options-activity-v2"
LLM_TIMEOUT_SECONDS = 60

SYSTEM_PROMPT = """You summarize a US options-activity snapshot for retail investors, in both Simplified Chinese and English.

Rules:
- Use ONLY numbers present in the input JSON. Never invent prices, dates or figures. Format dollars like $12.3M.
- "net_premium" is call premium traded minus put premium traded. It is NOT net buying: the data has no buy/sell side. Never say "bought" or "sold"; say "traded" / "成交".
- Never give buy/sell/hold advice, targets or predictions.
- When mentioning an implied range, say it is the options-implied range, not a forecast (期权隐含区间，而非确定走势).
- Large put activity may be hedging; say so when you highlight it.
- Compare put/call ratios with their baseline (median of earlier runs in the same session) when a baseline exists.
- "market" totals cover only the fixed core watchlist (market.tickers_scanned symbols). Other tickers were added for this run only; their "sources" say why: "earnings" (reports earnings within the next week; a core name can carry it too, and option premium before earnings often prices the expected move rather than a view), "mover" (big price move), "active" (unusually high volume), "kol" (much discussed by creators), "manual" (added by an admin for this run). Mention that reason when you highlight one of them.
- 2 to 4 points per language, each one or two sentences. The Chinese and English points say the same thing.
- sentiment: "bullish" if call premium clearly dominates, "bearish" if put premium clearly dominates, otherwise "mixed".
"""


class Summary(BaseModel):
    sentiment: Literal["bullish", "bearish", "mixed"]
    points_zh: list[str] = Field(min_length=1, max_length=4)
    points_en: list[str] = Field(min_length=1, max_length=4)


def prompt_input(report: dict, session: str, data_date: Optional[str]) -> dict:
    """The compact facts the model may cite."""
    tickers = {t["symbol"]: t for t in report["tickers"]}
    focus = {c["symbol"] for c in report["contributors"]["positive"] + report["contributors"]["negative"]}
    focus |= {c["underlying"] for c in report["contracts"][:8]}
    return {
        "session": session,
        "data_date": data_date,
        "market": report["market"],
        "top_net_premium": report["contributors"]["positive"],
        "bottom_net_premium": report["contributors"]["negative"],
        "largest_contracts": [
            {k: c[k] for k in ("underlying", "type", "strike", "expiration", "dte", "premium", "vol_oi", "otm_pct", "flags")}
            for c in report["contracts"][:8]
        ],
        "tickers": [
            {k: tickers[s].get(k) for k in ("symbol", "sources", "spot", "change_pct", "net_premium", "pc_premium_ratio", "pc_baseline", "implied_range", "earnings_date")}
            for s in sorted(focus)
            if s in tickers
        ],
    }


def _money(value: float) -> str:
    sign = "+" if value > 0 else "-" if value < 0 else ""
    value = abs(value)
    if value >= 1e9:
        return f"{sign}${value / 1e9:.2f}B"
    if value >= 1e6:
        return f"{sign}${value / 1e6:.1f}M"
    return f"{sign}${value / 1e3:.0f}K"


def template_summary(report: dict) -> Summary:
    market = report["market"]
    ratio = market.get("pc_premium_ratio")
    sentiment = "mixed" if ratio is None else "bullish" if ratio < 0.8 else "bearish" if ratio > 1.25 else "mixed"
    net = _money(market["net_premium"])
    ratio_text = f"{ratio:.2f}" if ratio is not None else "—"
    zh = [f"核心观察列表 {market.get('tickers_scanned', 0)} 个标的 Call 成交额 {_money(market['call_premium'])}，Put 成交额 {_money(market['put_premium'])}，净额 {net}，Put/Call 成交额比 {ratio_text}。"]
    en = [f"Across the {market.get('tickers_scanned', 0)}-symbol core watchlist, calls traded {_money(market['call_premium'])} and puts {_money(market['put_premium'])}: net {net}, put/call premium ratio {ratio_text}."]
    if report["contracts"]:
        top = report["contracts"][0]
        side = "Call" if top["type"] == "call" else "Put"
        zh.append(f"成交额最大的合约是 {top['underlying']} {top['expiration']} ${top['strike']:g} {side}，当日累计成交额 {_money(top['premium'])}。")
        en.append(f"The largest contract was {top['underlying']} {top['expiration']} ${top['strike']:g} {side}, with {_money(top['premium'])} traded today.")
    return Summary(sentiment=sentiment, points_zh=zh, points_en=en)


async def _structured(llm, messages) -> Summary:
    last: Optional[Exception] = None
    for method in STRUCTURED_METHODS:
        prompt = list(messages)
        if method == "json_mode":
            prompt.append(("system", "Reply with one JSON object only, matching this JSON schema:\n" + json.dumps(Summary.model_json_schema())))
        try:
            result = await llm.with_structured_output(Summary, method=method).ainvoke(prompt)
        except Exception as exc:
            if _is_auth_error(exc) or not _is_unsupported(exc):
                raise
            last = exc
            continue
        if isinstance(result, Summary):
            return result
        if isinstance(result, dict):
            return Summary.model_validate(result)
        last = ValueError(f"No structured summary via {method}")
    raise last or ValueError("No structured summary")


async def summarize(report: dict, session: str, data_date: Optional[str], llm=None) -> dict:
    """Returns {sentiment, points_zh, points_en, source, model_id, prompt_version}."""
    model_id = None
    try:
        if llm is None:
            from app.agent.llm import get_fast_llm

            llm = get_fast_llm()
        model_id = getattr(llm, "model_name", None) or getattr(llm, "model", None)
        facts = json.dumps(prompt_input(report, session, data_date), ensure_ascii=False, default=str)
        result = await asyncio.wait_for(_structured(llm, [("system", SYSTEM_PROMPT), ("user", facts)]), LLM_TIMEOUT_SECONDS)
        source = "ai"
    except Exception as exc:
        logger.warning("Options activity summary fell back to template: %s", exc)
        result, source, model_id = template_summary(report), "template", None
    return {**result.model_dump(), "source": source, "model_id": model_id, "prompt_version": PROMPT_VERSION}
