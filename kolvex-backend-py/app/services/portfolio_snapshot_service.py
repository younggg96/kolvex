"""
Portfolio Snapshot Service
Records and retrieves historical portfolio snapshots
"""

import logging
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from decimal import Decimal

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

OPTION_CONTRACT_MULTIPLIER = 100
CURRENT_SNAPSHOT_CALCULATION_VERSION = 2


def _is_missing_calculation_version_error(error: Exception) -> bool:
    """Return whether PostgREST has not loaded the calculation_version column."""
    error_code = getattr(error, "code", None)
    error_message = str(error).lower()
    return (
        error_code == "PGRST204"
        or "pgrst204" in error_message
        or (
            "calculation_version" in error_message
            and ("schema cache" in error_message or "could not find" in error_message)
        )
    )


def _safe_number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def calculate_position_snapshot_metrics(
    position: Dict[str, Any],
) -> Dict[str, float]:
    """Calculate market value, cost basis and unrealized P&L consistently."""
    position_type = position.get("position_type", "equity")
    signed_units = _safe_number(position.get("units"))
    units = abs(signed_units)
    price = abs(_safe_number(position.get("price")))
    average_price = abs(_safe_number(position.get("average_purchase_price")))
    is_short = signed_units < 0

    if position_type == "option":
        market_value = price * units * OPTION_CONTRACT_MULTIPLIER
        # Option average_purchase_price is stored as cost/credit per contract.
        cost_basis = average_price * units
        unrealized_pnl = (
            cost_basis - market_value
            if is_short
            else market_value - cost_basis
        )
        signed_market_value = -market_value if is_short else market_value
    else:
        market_value = price * units
        cost_basis = average_price * units
        raw_open_pnl = position.get("open_pnl")
        if raw_open_pnl is not None:
            unrealized_pnl = _safe_number(raw_open_pnl)
        else:
            unrealized_pnl = (
                cost_basis - market_value
                if is_short
                else market_value - cost_basis
            )
        signed_market_value = -market_value if is_short else market_value

    return {
        "market_value": signed_market_value,
        "cost_basis": cost_basis,
        "unrealized_pnl": unrealized_pnl,
    }


class PortfolioSnapshotService:
    """Service for managing portfolio snapshots"""
    
    def __init__(self):
        self.supabase = get_supabase_service()
    
    async def record_snapshot(
        self,
        user_id: str,
        total_value: float,
        total_cost_basis: float = 0,
        unrealized_pnl: float = 0,
        positions_count: int = 0,
        accounts_count: int = 0,
        positions_snapshot: Optional[List[Dict]] = None,
        snapshot_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Record a portfolio snapshot for a user.
        If a snapshot already exists for the date, it will be updated.
        
        Args:
            user_id: The user's ID
            total_value: Total portfolio value
            total_cost_basis: Total cost basis
            unrealized_pnl: Unrealized P&L
            positions_count: Number of positions
            accounts_count: Number of accounts
            positions_snapshot: Optional detailed positions data
            snapshot_date: Date of snapshot (defaults to today)
        
        Returns:
            The created/updated snapshot record
        """
        if snapshot_date is None:
            snapshot_date = date.today()
        
        # Calculate P&L percent
        pnl_percent = 0.0
        if total_cost_basis > 0:
            pnl_percent = (unrealized_pnl / total_cost_basis) * 100
        
        # Get current timestamp for snapshot_time (always update on upsert)
        current_time = datetime.now().isoformat()
        
        snapshot_data = {
            "user_id": user_id,
            "snapshot_date": snapshot_date.isoformat(),
            "snapshot_time": current_time,  # Always update timestamp on upsert
            "total_value": float(total_value),  # Ensure float type
            "total_cost_basis": float(total_cost_basis),
            "unrealized_pnl": float(unrealized_pnl),
            "unrealized_pnl_percent": float(pnl_percent),
            "positions_count": int(positions_count),
            "accounts_count": int(accounts_count),
            "positions_snapshot": positions_snapshot or [],
            "calculation_version": CURRENT_SNAPSHOT_CALCULATION_VERSION,
        }
        
        logger.info(f"📸 Recording snapshot for user {user_id[:8]}... data: {snapshot_data}")
        
        try:
            # Upsert to handle both insert and update
            result = self.supabase.table("portfolio_snapshots").upsert(
                snapshot_data,
                on_conflict="user_id,snapshot_date"
            ).execute()
        except Exception as e:
            if not _is_missing_calculation_version_error(e):
                logger.error(f"❌ Failed to record snapshot for user {user_id[:8]}: {type(e).__name__}: {e}")
                raise

            logger.warning(
                "portfolio_snapshots.calculation_version is not available yet; "
                "retrying snapshot write with the legacy schema"
            )
            legacy_snapshot_data = {
                key: value
                for key, value in snapshot_data.items()
                if key != "calculation_version"
            }
            result = self.supabase.table("portfolio_snapshots").upsert(
                legacy_snapshot_data,
                on_conflict="user_id,snapshot_date"
            ).execute()

        if result.data:
            logger.info(f"✅ Successfully recorded snapshot for user {user_id[:8]} on {snapshot_date}: {result.data[0].get('id', 'N/A')}")
            return result.data[0]

        logger.warning(f"⚠️ Upsert returned no data for user {user_id[:8]}. Response: {result}")
        return snapshot_data
    
    async def get_snapshots(
        self,
        user_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 365,
    ) -> List[Dict[str, Any]]:
        """
        Get portfolio snapshots for a user within a date range.
        
        Args:
            user_id: The user's ID
            start_date: Start date (inclusive)
            end_date: End date (inclusive, defaults to today)
            limit: Maximum number of records to return
        
        Returns:
            List of snapshot records ordered by date ascending
        """
        if end_date is None:
            end_date = date.today()
        
        def build_query(include_calculation_version: bool):
            selected_columns = (
                "snapshot_date, total_value, total_cost_basis, unrealized_pnl, "
                "unrealized_pnl_percent, positions_count"
            )
            if include_calculation_version:
                selected_columns += ", calculation_version"

            query = self.supabase.table("portfolio_snapshots").select(
                selected_columns
            ).eq("user_id", user_id)

            if include_calculation_version:
                query = query.gte(
                    "calculation_version", CURRENT_SNAPSHOT_CALCULATION_VERSION
                )

            query = query.lte("snapshot_date", end_date.isoformat()).order(
                "snapshot_date", desc=False
            ).limit(limit)

            if start_date:
                query = query.gte("snapshot_date", start_date.isoformat())

            return query

        try:
            try:
                result = build_query(include_calculation_version=True).execute()
            except Exception as e:
                if not _is_missing_calculation_version_error(e):
                    raise
                logger.warning(
                    "Reading portfolio snapshots with the legacy schema because "
                    "calculation_version is unavailable"
                )
                result = build_query(include_calculation_version=False).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get snapshots for user {user_id}: {e}")
            return []
    
    async def get_snapshots_by_period(
        self,
        user_id: str,
        period: str,
    ) -> List[Dict[str, Any]]:
        """
        Get portfolio snapshots for a specific period.
        
        Args:
            user_id: The user's ID
            period: Period string (1D, 1W, 1M, 3M, YTD, ALL)
        
        Returns:
            List of snapshot records
        """
        end_date = date.today()
        
        # Calculate start date based on period
        if period == "1D":
            start_date = end_date
        elif period == "1W":
            start_date = end_date - timedelta(days=7)
        elif period == "1M":
            start_date = end_date - timedelta(days=30)
        elif period == "3M":
            start_date = end_date - timedelta(days=90)
        elif period == "YTD":
            start_date = date(end_date.year, 1, 1)
        elif period == "ALL":
            start_date = None  # No start date limit
        else:
            start_date = end_date - timedelta(days=30)
        
        return await self.get_snapshots(user_id, start_date, end_date)
    
    async def get_latest_snapshot(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get the most recent snapshot for a user"""
        try:
            try:
                result = self.supabase.table("portfolio_snapshots").select("*").eq(
                    "user_id", user_id
                ).gte(
                    "calculation_version", CURRENT_SNAPSHOT_CALCULATION_VERSION
                ).order("snapshot_date", desc=True).limit(1).execute()
            except Exception as e:
                if not _is_missing_calculation_version_error(e):
                    raise
                result = self.supabase.table("portfolio_snapshots").select("*").eq(
                    "user_id", user_id
                ).order("snapshot_date", desc=True).limit(1).execute()
            
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to get latest snapshot for user {user_id}: {e}")
            return None
    
    async def get_first_snapshot_date(self, user_id: str) -> Optional[date]:
        """Get the date of the first snapshot for a user"""
        try:
            try:
                result = self.supabase.table("portfolio_snapshots").select(
                    "snapshot_date"
                ).eq("user_id", user_id).gte(
                    "calculation_version", CURRENT_SNAPSHOT_CALCULATION_VERSION
                ).order("snapshot_date", desc=False).limit(1).execute()
            except Exception as e:
                if not _is_missing_calculation_version_error(e):
                    raise
                result = self.supabase.table("portfolio_snapshots").select(
                    "snapshot_date"
                ).eq("user_id", user_id).order(
                    "snapshot_date", desc=False
                ).limit(1).execute()
            
            if result.data:
                return date.fromisoformat(result.data[0]["snapshot_date"])
            return None
        except Exception as e:
            logger.error(f"Failed to get first snapshot date for user {user_id}: {e}")
            return None


# Singleton instance
_snapshot_service: Optional[PortfolioSnapshotService] = None


def get_portfolio_snapshot_service() -> PortfolioSnapshotService:
    """Get or create the portfolio snapshot service instance"""
    global _snapshot_service
    if _snapshot_service is None:
        _snapshot_service = PortfolioSnapshotService()
    return _snapshot_service
