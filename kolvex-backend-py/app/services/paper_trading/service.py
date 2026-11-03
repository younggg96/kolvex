"""Authenticated persistence, authoritative quotes and the periodic matcher."""
import asyncio
import logging
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from uuid import uuid4

from .engine import TradingError, command, d, money, new_account, pending, summary

logger = logging.getLogger(__name__)


class StorageUnavailable(RuntimeError):
    pass


class Conflict(RuntimeError):
    pass


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def tradable_at(at, now):
    age = (now - at).total_seconds()
    ny = now.astimezone(ZoneInfo("America/New_York"))
    quote_ny = at.astimezone(ZoneInfo("America/New_York"))
    return (0 <= age <= 1200 and ny.weekday() < 5 and
            570 <= ny.hour * 60 + ny.minute < 960 and
            quote_ny.date() == ny.date() and 570 <= quote_ny.hour * 60 + quote_ny.minute < 960)


def normalize_quote(raw, now=None):
    now = now or datetime.now(timezone.utc)
    if raw.get("currency") != "USD" or raw.get("quote_type") not in ("EQUITY", "ETF"):
        raise TradingError("unsupported_security")
    price = d(raw.get("current_price"))
    if price <= 0:
        raise TradingError("quote_unavailable")
    stamp = raw.get("market_time")
    try:
        at = datetime.fromtimestamp(float(stamp), timezone.utc)
    except (ValueError, TypeError, OverflowError, OSError):
        raise TradingError("quote_time_unavailable") from None
    return {"price": money(price), "at": at.isoformat(), "tradable": tradable_at(at, now),
            "currency": "USD", "source": "Yahoo Finance (may be delayed)"}


class PaperTradingService:
    def __init__(self, db, quote_provider=None):
        self.db = db
        if quote_provider is None:
            from app.services.yfinance.client import get_yfinance_service
            quote_provider = get_yfinance_service().get_quote
        self.quote_provider = quote_provider

    def load(self, user_id):
        try:
            rows = self.db.table("paper_accounts").select("state,version").eq("user_id", user_id).execute().data
            if not rows:
                self.db.table("paper_accounts").upsert(
                    {"user_id": user_id, "state": new_account(utcnow()), "version": 0},
                    on_conflict="user_id", ignore_duplicates=True).execute()
                rows = self.db.table("paper_accounts").select("state,version").eq("user_id", user_id).execute().data
            if not rows:
                raise RuntimeError("account creation failed")
            return rows[0]
        except Exception as exc:
            logger.warning("Paper account storage unavailable: %s", type(exc).__name__)
            raise StorageUnavailable() from exc

    def get(self, user_id):
        row = self.load(user_id)
        return self.view(row)

    @staticmethod
    def view(row):
        # Internal idempotency receipts never need to travel to the browser.
        state = {k: v for k, v in row["state"].items() if k != "commands"}
        return {"state": state, "version": row["version"], "summary": summary(row["state"])}

    def quote(self, symbol):
        try:
            return normalize_quote(self.quote_provider(symbol))
        except TradingError:
            raise
        except Exception:
            raise TradingError("quote_unavailable") from None

    def mutate(self, user_id, body, quote_cache=None):
        quotes = {} if quote_cache is None else quote_cache
        for _ in range(4):
            row = self.load(user_id)
            state = row["state"]
            if body["request_id"] in state["commands"]:
                return self.view(row)
            symbols = {p["symbol"] for p in state["positions"]} | {o["symbol"] for o in pending(state)}
            if body.get("symbol"):
                symbols.add(body["symbol"])
            for symbol in sorted(symbols):
                if symbol not in quotes:
                    try:
                        quotes[symbol] = self.quote(symbol)
                    except TradingError:
                        # One failed symbol must not block matching other symbols or cancelling.
                        continue
            now = utcnow()
            # A long-running worker cycle must not keep trading after market close
            # or after a cached observation has aged past the freshness threshold.
            observed_now = datetime.fromisoformat(now)
            current_quotes = {symbol: {**quote, "tradable": quote["tradable"] and tradable_at(
                datetime.fromisoformat(quote["at"]), observed_now)} for symbol, quote in quotes.items() if symbol in symbols}
            updated = command(state, body, current_quotes, now)
            updated["quote_errors"] = sorted(symbols - current_quotes.keys())
            try:
                result = self.db.table("paper_accounts").update(
                    {"state": updated, "version": row["version"] + 1, "updated_at": now,
                     "active": bool(updated["positions"] or pending(updated))}
                ).eq("user_id", user_id).eq("version", row["version"]).execute()
            except Exception as exc:
                raise StorageUnavailable() from exc
            if result.data:
                return self.view({"state": updated, "version": row["version"] + 1})
        raise Conflict()

    def publish(self, user_id, position_id, note):
        state = self.load(user_id)["state"]
        if any(p["id"] == position_id for p in state["positions"]):
            raise TradingError("position_still_open")
        fills = [f for f in state["fills"] if f["position_id"] == position_id]
        if not fills or not any(f["effect"] == "close" for f in fills):
            raise TradingError("position_unavailable")
        snapshot = {"symbol": fills[0]["symbol"], "side": fills[0]["side"], "fills": fills,
                    "realized_pnl": money(sum((d(f["realized_pnl"]) for f in fills), d(0))),
                    "fees": money(sum((d(f["fee"]) for f in fills), d(0)))}
        try:
            result = self.db.table("paper_reviews").upsert(
                {"user_id": user_id, "position_id": position_id, "note": note, "snapshot": snapshot,
                 "published_at": utcnow()}, on_conflict="user_id,position_id").execute()
            return result.data[0]
        except Exception as exc:
            raise StorageUnavailable() from exc

    def reviews(self, user_id, offset):
        try:
            rows = self.db.table("paper_reviews").select("id,user_id,note,snapshot,published_at").order(
                "published_at", desc=True).order("id").range(offset, offset + 20).execute().data
            return {"items": [{"id": r["id"], "is_mine": r["user_id"] == user_id,
                               "author": "Learner " + r["user_id"].replace("-", "")[:8],
                               "note": r["note"], "snapshot": r["snapshot"], "published_at": r["published_at"]}
                              for r in rows[:20]], "has_more": len(rows) > 20}
        except Exception as exc:
            raise StorageUnavailable() from exc

    def unpublish(self, user_id, review_id):
        try:
            self.db.table("paper_reviews").delete().eq("user_id", user_id).eq("id", review_id).execute()
            return {"ok": True}
        except Exception as exc:
            raise StorageUnavailable() from exc


def match_cycle():
    from app.core.supabase import get_supabase_service
    service = PaperTradingService(get_supabase_service())
    cursor = None
    quote_cache = {}
    while True:
        query = service.db.table("paper_accounts").select("user_id").eq("active", True).order("user_id").limit(50)
        if cursor:
            query = query.gt("user_id", cursor)
        rows = query.execute().data
        for row in rows:
            try:
                service.mutate(row["user_id"], {"action": "sync", "request_id": str(uuid4())}, quote_cache)
            except Exception:
                logger.exception("Paper trading account match failed")
        if len(rows) < 50:
            break
        cursor = rows[-1]["user_id"]


async def run_worker():
    # Opt in after applying the schema. Multiple replicas are safe under version CAS.
    if os.getenv("PAPER_TRADING_WORKER_ENABLED", "false").lower() != "true":
        return
    while True:
        try:
            await asyncio.to_thread(match_cycle)
        except Exception:
            logger.exception("Paper trading matcher unavailable")
        await asyncio.sleep(60)
