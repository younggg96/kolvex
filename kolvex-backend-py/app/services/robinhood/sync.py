"""Robinhood portfolio synchronization MVP.

Run from the backend directory with:

    python -m app.services.robinhood
"""

from __future__ import annotations

import datetime as dt
import logging
import os

import pyotp
import robin_stocks.robinhood as r
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.services.robinhood.models import (
    Holding,
    PortfolioSnapshot,
    StockOrder,
    SyncLog,
    init_db,
    utcnow,
)

logger = logging.getLogger(__name__)


def _safe_float(value: object, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_robinhood_timestamp(value: str | None) -> dt.datetime | None:
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(normalized)
    except ValueError:
        parsed = dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(
            tzinfo=dt.UTC
        )

    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(dt.UTC).replace(tzinfo=None)
    return parsed


def login_robinhood() -> bool:
    """Log in using env vars and cache the Robinhood session locally."""

    username = os.getenv("ROBINHOOD_USERNAME")
    password = os.getenv("ROBINHOOD_PASSWORD")
    totp_secret = os.getenv("ROBINHOOD_TOTP_SECRET")

    if not username or not password:
        logger.error("Missing ROBINHOOD_USERNAME or ROBINHOOD_PASSWORD")
        return False

    mfa_code = pyotp.TOTP(totp_secret).now() if totp_secret else None

    try:
        r.login(username, password, mfa_code=mfa_code, store_session=True)
    except Exception:
        logger.exception("Robinhood login failed")
        return False

    logger.info("Successfully logged into Robinhood")
    return True


def sync_portfolio(session: Session) -> int:
    """Fetch and upsert the current daily portfolio snapshot."""

    logger.info("Fetching portfolio data")
    profile = r.build_user_profile()
    equity = _safe_float(profile.get("equity"))

    snapshot = PortfolioSnapshot(
        snapshot_date=utcnow().date(),
        portfolio_value=equity,
        cash_balance=_safe_float(profile.get("cash")),
        buying_power=_safe_float(profile.get("buying_power")),
        total_equity=equity,
    )
    session.merge(snapshot)
    return 1


def sync_holdings(session: Session) -> int:
    """Fetch and upsert current active holdings."""

    logger.info("Fetching current holdings")
    holdings_data = r.build_holdings()
    count = 0

    for ticker, data in holdings_data.items():
        holding = Holding(
            ticker=ticker,
            company_name=data.get("name") or ticker,
            quantity=_safe_float(data.get("quantity")),
            average_buy_price=_safe_float(data.get("average_buy_price")),
            current_price=_safe_float(data.get("price")),
            market_value=_safe_float(data.get("equity")),
            equity_percentage=_safe_float(data.get("percentage")),
            unrealized_gain_loss=_safe_float(data.get("equity_change")),
            unrealized_gain_loss_percent=_safe_float(data.get("percent_change")),
        )
        session.merge(holding)
        count += 1

    return count


def sync_orders(session: Session) -> int:
    """Fetch and upsert historical stock orders."""

    logger.info("Fetching stock order history")
    orders_data = r.get_all_stock_orders()
    count = 0

    for raw_order in orders_data:
        order_id = raw_order.get("id")
        instrument_url = raw_order.get("instrument")
        created_at = _parse_robinhood_timestamp(raw_order.get("created_at"))

        if not order_id or not instrument_url or created_at is None:
            logger.warning("Skipping malformed Robinhood order: %s", raw_order)
            continue

        ticker = r.get_symbol_by_url(instrument_url) or "UNKNOWN"
        quantity = _safe_float(
            raw_order.get("cumulative_quantity") or raw_order.get("quantity")
        )
        avg_price = _safe_float(raw_order.get("average_price"))

        order = StockOrder(
            order_id=order_id,
            ticker=ticker,
            side=raw_order.get("side") or "",
            order_type=raw_order.get("type") or "",
            quantity=quantity,
            average_price=avg_price if avg_price > 0 else None,
            total_amount=quantity * avg_price,
            state=raw_order.get("state") or "",
            created_time=created_at,
            executed_time=_parse_robinhood_timestamp(
                raw_order.get("last_transaction_at")
            ),
            fees=_safe_float(raw_order.get("fees")),
        )
        session.merge(order)
        count += 1

    return count


def _get_database_url(database_url: str | None = None) -> str:
    if database_url:
        return database_url

    robinhood_url = os.getenv("ROBINHOOD_DATABASE_URL")
    if robinhood_url:
        return robinhood_url

    shared_url = os.getenv("DATABASE_URL")
    if shared_url and shared_url.startswith("sqlite"):
        return shared_url

    return "sqlite:///robinhood_sync.db"


def run_sync(database_url: str | None = None) -> int:
    """Run a full Robinhood sync and return the number of processed records."""

    load_dotenv()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )

    if not login_robinhood():
        return 0

    SessionLocal = init_db(_get_database_url(database_url))

    with SessionLocal() as session:
        sync_log = SyncLog(status="running")
        session.add(sync_log)
        session.commit()

        try:
            total_records = (
                sync_portfolio(session) + sync_holdings(session) + sync_orders(session)
            )
            sync_log.status = "success"
            sync_log.records_synced = total_records
            session.commit()
            logger.info("Robinhood sync completed: %s records processed", total_records)
            return total_records
        except Exception as exc:
            session.rollback()
            logger.exception("Robinhood sync failed")
            sync_log.status = "failed"
            sync_log.error_message = str(exc)
            session.add(sync_log)
            session.commit()
            return 0


def main() -> None:
    run_sync()


if __name__ == "__main__":
    main()
