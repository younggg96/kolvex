"""SQLAlchemy models for the standalone Robinhood sync cache."""

from __future__ import annotations

import datetime as dt

from sqlalchemy import Date, DateTime, Float, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase):
    pass


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC).replace(tzinfo=None)


class SyncLog(Base):
    """Log table for Robinhood sync executions."""

    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sync_time: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    records_synced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)


class PortfolioSnapshot(Base):
    """One account-value snapshot per UTC day."""

    __tablename__ = "portfolio_snapshots"

    snapshot_date: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    portfolio_value: Mapped[float] = mapped_column(Float, nullable=False)
    cash_balance: Mapped[float] = mapped_column(Float, nullable=False)
    buying_power: Mapped[float] = mapped_column(Float, nullable=False)
    total_equity: Mapped[float] = mapped_column(Float, nullable=False)


class Holding(Base):
    """Current open positions, upserted by ticker."""

    __tablename__ = "holdings"

    ticker: Mapped[str] = mapped_column(String(10), primary_key=True)
    company_name: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    average_buy_price: Mapped[float] = mapped_column(Float, nullable=False)
    current_price: Mapped[float] = mapped_column(Float, nullable=False)
    market_value: Mapped[float] = mapped_column(Float, nullable=False)
    equity_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    unrealized_gain_loss: Mapped[float] = mapped_column(Float, nullable=False)
    unrealized_gain_loss_percent: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime,
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class StockOrder(Base):
    """Historical stock orders, deduplicated by Robinhood order ID."""

    __tablename__ = "stock_orders"

    order_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    ticker: Mapped[str] = mapped_column(String(10), nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    order_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    average_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False)
    created_time: Mapped[dt.datetime] = mapped_column(DateTime, nullable=False)
    executed_time: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    fees: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)


def init_db(database_url: str) -> sessionmaker:
    engine = create_engine(database_url, echo=False, future=True)
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, expire_on_commit=False)
