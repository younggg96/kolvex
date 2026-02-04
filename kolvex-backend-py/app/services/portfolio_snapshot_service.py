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
        }
        
        logger.info(f"📸 Recording snapshot for user {user_id[:8]}... data: {snapshot_data}")
        
        try:
            # Upsert to handle both insert and update
            result = self.supabase.table("portfolio_snapshots").upsert(
                snapshot_data,
                on_conflict="user_id,snapshot_date"
            ).execute()
            
            if result.data:
                logger.info(f"✅ Successfully recorded snapshot for user {user_id[:8]} on {snapshot_date}: {result.data[0].get('id', 'N/A')}")
                return result.data[0]
            else:
                logger.warning(f"⚠️ Upsert returned no data for user {user_id[:8]}. Response: {result}")
                return snapshot_data
        except Exception as e:
            logger.error(f"❌ Failed to record snapshot for user {user_id[:8]}: {type(e).__name__}: {e}")
            # Re-raise to let caller handle
            raise
    
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
        
        try:
            query = self.supabase.table("portfolio_snapshots").select(
                "snapshot_date, total_value, unrealized_pnl, unrealized_pnl_percent, positions_count"
            ).eq("user_id", user_id).lte("snapshot_date", end_date.isoformat()).order(
                "snapshot_date", desc=False
            ).limit(limit)
            
            if start_date:
                query = query.gte("snapshot_date", start_date.isoformat())
            
            result = query.execute()
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
            result = self.supabase.table("portfolio_snapshots").select(
                "snapshot_date"
            ).eq("user_id", user_id).order("snapshot_date", desc=False).limit(1).execute()
            
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
