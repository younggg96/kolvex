"""AI research candidates for one options-activity run.

Generated once per run with the server's DeepSeek key and shared by every user.
The model only supplies reasoning: each item must name a contract from this run,
and everything shown about that contract comes from the run's own data. Items
that do not match are dropped. Any failure leaves the report untouched.
"""

import asyncio
import json
import logging
import re
from typing import Any, Optional

from app.services.research_workspace import _final_text

logger = logging.getLogger(__name__)
PROMPT_VERSION = "options-candidates-v1"
MODEL = "deepseek-v4-pro"
LLM_TIMEOUT_SECONDS = 240
MAX_CANDIDATES = 4
MAX_TEXT_CHARS = 400

SYSTEM_PROMPT = """You select research candidates from one US options-activity snapshot. The list is the same for every reader and knows nothing about anyone's holdings. A candidate is a contract worth researching further, not an order instruction.

Output JSON only, no prose or code fence:
{"candidates": [{"contract": "<contract field, copied exactly>", "underlying": "...", "type": "call" | "put", "strike": 0, "expiration": "YYYY-MM-DD", "thesis_zh": "...", "thesis_en": "...", "risk_zh": "...", "risk_en": "...", "invalidation_zh": "...", "invalidation_en": "...", "confidence": "low" | "medium" | "high"}]}

Rules:
- Choose only from the "contracts" array. Copy contract, underlying, type, strike and expiration exactly. Never create or adjust a contract.
- Return up to 4 candidates, each on a different underlying. Return fewer, or an empty list, when the data does not support more. Prefer single stocks with several agreeing facts over index ETF contracts.
- A call is studied for upside and a put for downside. thesis explains why this direction deserves research, citing at least two facts from the input.
- The data is delayed and has no buy/sell side. Premium and volume show where money traded and nothing more. Say "traded" / "成交".
- Never use these words, even when negating them: bought, sold, buy signal, sell signal, smart money, net buying, 买入信号, 卖出信号, 聪明钱, 主力, 净买入, 大举买入.
- Large put activity is often hedging. For every put, risk must say the volume may be a hedge rather than a directional view.
- risk covers what is specific to this contract: time decay given its dte, IV level, an earnings date inside its life (flags.crosses_earnings), and how far out of the money it is.
- invalidation is one observable condition using a level from the input (implied_range low or high, max_pain, gamma_level). It must not already be true now: for a call the price level must be below the underlying's spot, for a put above it. Do not call it a stop.
- Do not give entries, position sizes, targets, or wording such as "should buy" / "建议买入". Use only numbers present in the input.
- confidence measures how well independent facts in the input agree. Without trade side data, "high" should be rare.
- Write for retail readers. Never show input field names such as pc_premium_ratio, vol_oi, dte, otm_pct, max_pain, implied_range, gamma_level or new_positions. Say Put/Call 成交额比 (put/call premium ratio), 成交量是持仓量的 6.4 倍 (volume 6.4x open interest), 39 天后到期 (39 days to expiry), 隐含区间下沿/上沿 (implied range low/high), Max Pain, Gamma 价位 (gamma level).
- Format dollars like $43.6M, prices like $490, IV as a percentage like 65%, ratios to two decimals.
- Each text is one or two sentences. The Chinese and English versions say the same thing.
"""

CONFIDENCE_ALIASES = {
    "low": "low", "低": "low", "较低": "low", "偏低": "low",
    "medium": "medium", "moderate": "medium", "mid": "medium", "中": "medium", "中等": "medium", "一般": "medium",
    "high": "high", "高": "high", "较高": "high", "偏高": "high",
}
TYPE_ALIASES = {"call": "call", "c": "call", "看涨": "call", "认购": "call", "put": "put", "p": "put", "看跌": "put", "认沽": "put"}
TEXT_FIELDS = ("thesis_zh", "thesis_en", "risk_zh", "risk_en", "invalidation_zh", "invalidation_en")
# Copied from the contract row, never from the model.
CONTRACT_FIELDS = ("symbol", "underlying", "is_etf", "type", "strike", "expiration", "dte", "premium", "volume",
                   "open_interest", "vol_oi", "price", "iv", "delta", "otm_pct", "flags")
FORBIDDEN = re.compile(
    r"买入信号|卖出信号|聪明钱|主力|净买入|大举买入|建议买入|建议卖出|应该买入|buy signal|sell signal|smart money"
    r"|net buying|should buy|should sell|\bbought\b|\bsold\b",
    re.I,
)


def prompt_input(report: dict, session: str, data_date: Optional[str]) -> dict:
    """The contracts the model may pick and the facts it may cite."""
    pool = report["candidate_contracts"]
    tickers = {t["symbol"]: t for t in report["tickers"]}
    underlyings = sorted({c["underlying"] for c in pool})
    return {
        "session": session,
        "data_date": data_date,
        "market": report["market"],
        "contracts": [
            {"contract": c["symbol"], **{k: c.get(k) for k in CONTRACT_FIELDS if k not in ("symbol", "volume", "open_interest")}}
            for c in pool
        ],
        "tickers": [
            {k: tickers[s].get(k) for k in ("symbol", "is_etf", "spot", "change_pct", "net_premium", "pc_premium_ratio", "pc_baseline", "implied_range", "max_pain", "gamma_level", "earnings_date")}
            for s in underlyings
            if s in tickers
        ],
    }


def parse_candidates(text: str) -> Optional[list]:
    """Tolerant JSON parse: fenced or surrounded JSON, wrapped or bare list. None when unreadable."""
    match = re.search(r"[\[{].*[\]}]", text or "", re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except ValueError:
        return None
    items = data.get("candidates") if isinstance(data, dict) else data
    return items if isinstance(items, list) else None


def _same_strike(claimed: Any, actual: float) -> bool:
    try:
        return abs(float(claimed) - float(actual)) < 1e-6
    except (TypeError, ValueError):
        return False


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _validated(item: Any, pool: dict[str, dict]) -> Optional[dict]:
    if not isinstance(item, dict):
        return None
    contract = pool.get(_clean(item.get("contract")).upper())
    if contract is None:
        return None
    if (
        _clean(item.get("underlying")).upper() != contract["underlying"]
        or TYPE_ALIASES.get(_clean(item.get("type")).lower()) != contract["type"]
        or not _same_strike(item.get("strike"), contract["strike"])
        or _clean(item.get("expiration"))[:10] != contract["expiration"]
    ):
        return None
    confidence = CONFIDENCE_ALIASES.get(_clean(item.get("confidence")).lower())
    texts = {field: _clean(item.get(field)) for field in TEXT_FIELDS}
    if confidence is None or not all(texts.values()):
        return None
    if any(len(text) > MAX_TEXT_CHARS or FORBIDDEN.search(text) for text in texts.values()):
        return None
    return {**{k: contract.get(k) for k in CONTRACT_FIELDS}, **texts, "confidence": confidence}


def validate_candidates(items: list, pool_rows: list[dict]) -> tuple[list[dict], int]:
    """Keeps items naming a real contract, one per underlying. Returns (valid, dropped count)."""
    pool = {c["symbol"]: c for c in pool_rows}
    valid: list[dict] = []
    seen: set[str] = set()
    for item in items:
        checked = _validated(item, pool)
        if checked and checked["underlying"] not in seen and len(valid) < MAX_CANDIDATES:
            seen.add(checked["underlying"])
            valid.append(checked)
    return valid, len(items) - len(valid)


def _unavailable(reason: str) -> dict:
    return {"status": "unavailable", "reason": reason, "items": [], "prompt_version": PROMPT_VERSION}


async def generate_candidates(report: dict, session: str, data_date: Optional[str], llm=None) -> dict:
    """Returns {status, items, ...}. Never raises: a failure here must not affect the report."""
    try:
        if not report.get("candidate_contracts"):
            return _unavailable("no_eligible_contracts")
        if llm is None:
            from app.agent.llm import _create_llm

            llm = _create_llm("deepseek", MODEL, temperature=0.2)
        facts = json.dumps(prompt_input(report, session, data_date), ensure_ascii=False, default=str)
        reply = await asyncio.wait_for(llm.ainvoke([("system", SYSTEM_PROMPT), ("human", facts)]), LLM_TIMEOUT_SECONDS)
        items = parse_candidates(_final_text([reply]) or str(getattr(reply, "content", "")))
        if items is None:
            logger.warning("Options candidates: model output was not valid JSON")
            return _unavailable("invalid_output")
        valid, dropped = validate_candidates(items, report["candidate_contracts"])
        if dropped:
            logger.warning("Options candidates: dropped %d of %d items", dropped, len(items))
        if not valid:
            return _unavailable("no_valid_candidates")
        return {
            "status": "ok",
            "items": valid,
            "dropped": dropped,
            "model_id": getattr(llm, "model_name", None) or getattr(llm, "model", None),
            "prompt_version": PROMPT_VERSION,
        }
    except Exception as exc:
        logger.warning("Options candidates unavailable: %s", exc)
        return _unavailable("model_error")
