"""Smart-money tools: tracked managers' 13F holdings, congressional trade disclosures and options activity.

All three are disclosures or snapshots with a delay: 13F is quarterly and filed up to 45 days after the
quarter, congressional trades are filed up to 45 days after the trade, and options activity is a run
snapshot. Every payload carries its own dates so the answer can say how old the data is.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

from langchain_core.tools import tool

from app.core.supabase import get_supabase_service
from app.services.sec.client import MANAGERS
from app.services.sec.holdings_store import FILINGS, HOLDINGS

logger = logging.getLogger(__name__)

HOLDER_FIELDS = "accession,ticker,issuer,class,put_call,value,shares,previous_shares,change,change_percent,weight,activity"
TOP_HOLDINGS = 15
TOP_CHANGES = 8
MAX_TRADES = 30
MAX_OPTION_TICKERS = 10
DISCLOSURE_NOTE = (
    "13F filings are quarterly snapshots of long US-listed positions, filed up to 45 days after the "
    "quarter ends; they do not show shorts, most non-US holdings or trades since the quarter end."
)

# Names Chinese-speaking users use for the tracked managers.
MANAGER_ALIASES = {
    "巴菲特": "berkshire", "伯克希尔": "berkshire", "buffett": "berkshire",
    "桥水": "bridgewater", "达里奥": "bridgewater", "dalio": "bridgewater",
    "潘兴": "pershing", "阿克曼": "pershing", "ackman": "pershing",
    "德鲁肯米勒": "duquesne", "druckenmiller": "duquesne",
    "泰珀": "appaloosa", "tepper": "appaloosa",
    "卡拉曼": "baupost", "klarman": "baupost",
    "老虎环球": "tiger", "三点": "third_point", "勒布": "third_point", "loeb": "third_point",
    "橡树": "oaktree", "霍华德·马克斯": "oaktree", "howard marks": "oaktree",
    "文艺复兴": "renaissance", "西蒙斯": "renaissance",
    "段永平": "duan_yongping", "李录": "himalaya", "喜马拉雅": "himalaya",
    "高瓴": "hhlr", "景林": "greenwoods", "淡马锡": "temasek",
    "帕伯莱": "pabrai", "pabrai": "pabrai",
    "伊坎": "icahn", "木头姐": "ark", "凯西·伍德": "ark", "cathie wood": "ark",
    "索罗斯": "soros", "盖茨": "gates", "比尔·盖茨": "gates",
}  # fmt: skip


def _norm(value) -> str:
    return " ".join(str(value or "").split()).casefold()


def find_manager(query: str) -> list[str]:
    """Tracked manager ids matching a name, alias or id; exact matches first."""
    wanted = _norm(query).replace(" ", "_")
    plain = _norm(query)
    if not plain:
        return []
    if wanted in MANAGERS:
        return [wanted]
    if plain in MANAGER_ALIASES:
        return [MANAGER_ALIASES[plain]]
    # A sentence that names an alias ("巴菲特最近买了什么"), or a fragment long enough to mean something:
    # two Chinese characters ("老虎") or three Latin letters.
    long_enough = len(plain) >= (2 if not plain.isascii() else 3)
    found = [
        mid for alias, mid in MANAGER_ALIASES.items()
        if alias in plain or (long_enough and plain in alias)
    ]  # fmt: skip
    if long_enough:
        found += [mid for mid, m in MANAGERS.items() if plain in _norm(m["name"]) or plain in mid]
    return list(dict.fromkeys(found))


def _latest_filings(db) -> dict[str, dict]:
    """The newest complete filing per tracked manager."""
    rows = (
        db.table(FILINGS).select("manager_id,manager_name,accession,period,filed")
        .eq("complete", True).order("period", desc=True).order("filed", desc=True)
        .limit(1000).execute().data or []
    )  # fmt: skip
    latest: dict[str, dict] = {}
    for row in rows:
        if row.get("manager_id") in MANAGERS:
            latest.setdefault(row["manager_id"], row)
    return latest


def institutional_holders_payload(ticker: str) -> dict:
    db = get_supabase_service()
    symbol = ticker.strip().upper()
    latest = _latest_filings(db)
    by_accession = {row["accession"]: row for row in latest.values()}
    holdings = (
        db.table(HOLDINGS).select(HOLDER_FIELDS).eq("ticker", symbol)
        .in_("accession", list(by_accession)).execute().data or []
    ) if by_accession else []  # fmt: skip
    holders = []
    for h in holdings:
        filing = by_accession.get(h.get("accession"))
        if not filing:
            continue
        holders.append(
            {
                "manager": filing["manager_name"],
                "manager_id": filing["manager_id"],
                "quarter_end": filing["period"],
                "filed": filing["filed"],
                "put_call": h.get("put_call"),
                "activity": h.get("activity"),
                "shares": h.get("shares"),
                "previous_shares": h.get("previous_shares"),
                "change_percent": h.get("change_percent"),
                "value_usd": h.get("value"),
                "portfolio_weight_pct": h.get("weight"),
            }
        )
    holders.sort(key=lambda h: -(h["portfolio_weight_pct"] or 0))
    payload = {
        "ticker": symbol,
        "tracked_managers": len(MANAGERS),
        "managers_with_filings": len(latest),
        "holder_count": sum(1 for h in holders if h["activity"] != "exited"),
        "holders": holders,
        "note": DISCLOSURE_NOTE,
    }
    if not latest:
        payload["gap"] = "unavailable"
    return payload


@tool
def get_institutional_holders(ticker: str) -> str:
    """Which tracked superinvestors (Berkshire, Bridgewater, 段永平/H&H, Himalaya, ARK ...) hold a stock
    in their latest 13F, with shares, portfolio weight and the change from the prior quarter.

    activity is new, increased, reduced, unchanged, exited (sold out in that quarter) or unknown.
    Always give each holder's quarter_end and filed date: 13F data is delayed and quarterly.

    Args:
        ticker: Stock ticker, e.g. "AAPL".
    """
    try:
        payload = institutional_holders_payload(ticker)
    except Exception as error:  # noqa: BLE001
        logger.warning("get_institutional_holders failed for %s: %s", ticker, error)
        payload = {
            "gap": "unavailable",
            "error": "13F holdings unavailable",
            "ticker": ticker.upper(),
        }
    return json.dumps(payload, ensure_ascii=False, default=str)


def _holding(row: dict) -> dict:
    return {
        "ticker": row.get("ticker"),
        "issuer": row.get("issuer"),
        "put_call": row.get("put_call"),
        "activity": row.get("activity"),
        "shares": row.get("shares"),
        "change_percent": row.get("change_percent"),
        "value_usd": row.get("value"),
        "portfolio_weight_pct": row.get("weight"),
    }


def superinvestor_payload(data: dict) -> dict:
    holdings = data.get("holdings") or []
    held = sorted(
        (h for h in holdings if h.get("activity") != "exited"),
        key=lambda h: -(h.get("weight") or 0),
    )

    def moved(kind: str) -> list[dict]:
        rows = [h for h in holdings if h.get("activity") == kind]
        rows.sort(key=lambda h: -abs(h.get("value") or 0))
        return [_holding(h) for h in rows[:TOP_CHANGES]]

    filing = data.get("filing") or {}
    return {
        "manager": data.get("name"),
        "manager_id": data.get("id"),
        "quarter_end": filing.get("period"),
        "filed": filing.get("filed"),
        "positions": len(held),
        "top_holdings": [_holding(h) for h in held[:TOP_HOLDINGS]],
        "new": moved("new"),
        "increased": moved("increased"),
        "reduced": moved("reduced"),
        "exited": moved("exited"),
        "partial": bool(data.get("partial")),
        "note": DISCLOSURE_NOTE,
    }


@tool
async def get_superinvestor_portfolio(manager: str) -> str:
    """A tracked superinvestor's latest 13F: top holdings by weight and what they bought, added,
    trimmed or sold out that quarter.

    Accepts a tracked manager's name, id or common Chinese name, e.g. "巴菲特", "段永平", "李录",
    "ARK", "Bridgewater". If the result has "status": "ambiguous", ask which manager the user means;
    if "not_tracked", list a few tracked managers from "tracked". Give quarter_end and filed date.

    Args:
        manager: Manager name, alias or id.
    """
    from app.services.sec.holdings_store import institution_store

    matches = find_manager(manager)
    if not matches:
        payload = {
            "status": "not_tracked",
            "manager": manager,
            "tracked": sorted(m["name"] for m in MANAGERS.values()),
        }
        return json.dumps(payload, ensure_ascii=False)
    if len(matches) > 1:
        payload = {"status": "ambiguous", "candidates": [MANAGERS[m]["name"] for m in matches[:10]]}
        return json.dumps(payload, ensure_ascii=False)
    try:
        data = await institution_store.latest(matches[0])
        if data is None:
            # Not synced yet: queue the sync the Superinvestors page would have queued.
            institution_store.sync_later(matches[0])
            payload = {"gap": "unavailable", "error": "this manager's 13F is not loaded yet",
                       "manager": MANAGERS[matches[0]]["name"]}  # fmt: skip
        else:
            payload = superinvestor_payload(data)
    except Exception as error:  # noqa: BLE001
        logger.warning("get_superinvestor_portfolio failed for %s: %s", manager, error)
        payload = {"gap": "unavailable", "error": "13F holdings unavailable", "manager": manager}
    return json.dumps(payload, ensure_ascii=False, default=str)


def congress_payload(ticker: Optional[str], member: Optional[str], days: int) -> dict:
    db = get_supabase_service()
    days = max(7, min(int(days), 365))
    since = (date.today() - timedelta(days=days)).isoformat()
    query = (
        db.table("congress_trades")
        .select("member_name,chamber,ticker,asset_name,trade_date,filed_date,direction,transaction_type,amount_range,source_url")
        .gte("filed_date", since)
    )  # fmt: skip
    if ticker and ticker.strip():
        query = query.eq("ticker", ticker.strip().upper())
    if member and member.strip():
        name = member.strip()[:100]
        name = (
            name.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").replace("*", "\\*")
        )
        query = query.ilike("member_name", f"%{name}%")
    rows = (
        query.order("filed_date", desc=True)
        .order("id", desc=True)
        .limit(MAX_TRADES + 1)
        .execute()
        .data
        or []
    )
    payload = {
        "ticker": ticker.upper() if ticker else None,
        "member": member,
        "window_days": days,
        "trade_count": min(len(rows), MAX_TRADES),
        "truncated": len(rows) > MAX_TRADES,
        "trades": rows[:MAX_TRADES],
        "note": "Disclosures are filed up to 45 days after the trade; amounts are ranges, not exact values.",
    }
    if not rows:
        synced = db.table("congress_trade_sync").select("fetched_at").limit(1).execute().data
        payload["gap"] = "no_data" if synced else "unavailable"
    return payload


@tool
def get_congress_trades(
    ticker: Optional[str] = None, member: Optional[str] = None, days: int = 90
) -> str:
    """US Congress members' stock trade disclosures, newest filing first.

    Each trade has the member, chamber, ticker, trade_date, filed_date, direction (buy / sell /
    exchange / other) and the disclosed amount range. Give both dates: filed_date can be weeks
    after trade_date. Never present a range as an exact amount.

    Args:
        ticker: Optional ticker, e.g. "NVDA".
        member: Optional part of a member's name in English, e.g. "Pelosi".
        days: Look-back window on filing date (7-365, default 90).
    """
    try:
        payload = congress_payload(ticker, member, days)
    except Exception as error:  # noqa: BLE001
        logger.warning("get_congress_trades failed: %s", error)
        payload = {"gap": "unavailable", "error": "congress trades unavailable"}
    return json.dumps(payload, ensure_ascii=False, default=str)


def _scalars(item: dict) -> dict:
    return {k: v for k, v in item.items() if not isinstance(v, (dict, list))}


def options_activity_payload(run: dict, ticker: Optional[str]) -> dict:
    payload = run.get("payload") or {}
    summary = run.get("summary") or {}
    tickers = payload.get("tickers") or []
    wanted = ticker.strip().upper() if ticker and ticker.strip() else None
    out = {
        "trade_date": run.get("trade_date"),
        "session": run.get("session"),
        "data_date": run.get("data_date"),
        "run_at": run.get("run_at"),
        "market": payload.get("market"),
        "top_net_call_premium": (payload.get("contributors") or {}).get("positive", [])[:5],
        "top_net_put_premium": (payload.get("contributors") or {}).get("negative", [])[:5],
        "summary_points": summary.get("points_zh") or summary.get("points_en"),
        "note": "Premium totals are the day's option volume times price for the scanned list only; "
        "they do not say whether trades opened or closed positions or who traded.",
    }
    if wanted:
        match = next((t for t in tickers if t.get("symbol") == wanted), None)
        out["ticker"] = wanted
        out["ticker_activity"] = _scalars(match) if match else None
        out["largest_contracts"] = [
            _scalars(c) for c in payload.get("contracts") or [] if c.get("underlying") == wanted
        ][:5]
        if match is None:
            out["ticker_note"] = "This ticker was not in the scanned list for this run."
    else:
        out["most_active"] = [_scalars(t) for t in tickers[:MAX_OPTION_TICKERS]]
    return out


@tool
async def get_options_activity(ticker: Optional[str] = None) -> str:
    """Kolvex's latest unusual options activity run: call vs put premium for the market and the most
    active tickers, or one ticker's premium, put/call ratio and largest contracts.

    Give the run's data_date and session (pre / intraday / post). This is aggregate option volume,
    not proof of who traded or of a directional bet: do not call it smart money buying.

    Args:
        ticker: Optional ticker, e.g. "TSLA".
    """
    from app.services.options_activity import store

    try:
        run = await store.get_run(get_supabase_service())
        payload = (
            options_activity_payload(run, ticker)
            if run
            else {"gap": "no_data", "error": "no options activity run yet"}
        )
    except Exception as error:  # noqa: BLE001
        logger.warning("get_options_activity failed: %s", error)
        payload = {"gap": "unavailable", "error": "options activity unavailable"}
    return json.dumps(payload, ensure_ascii=False, default=str)
