"""
SnapTrade Sync Routes
Endpoints for syncing account and position data
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from starlette import status as http_status
from typing import List
import logging

from app.api.dependencies.auth import get_current_user_id
from app.services.snaptrade import SnapTradeService, get_snaptrade_service
from app.services.portfolio_snapshot_service import get_portfolio_snapshot_service
from .schemas import AccountResponse, MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync")


async def record_portfolio_snapshot_background(user_id: str, service: SnapTradeService):
    """Background task to record portfolio snapshot after sync"""
    try:
        # Get holdings to calculate totals
        holdings = await service.get_user_holdings(user_id)
        
        if not holdings or not holdings.get("accounts"):
            return
        
        total_value = 0.0
        total_cost_basis = 0.0
        total_pnl = 0.0
        positions_count = 0
        accounts_count = len(holdings["accounts"])
        
        for account in holdings["accounts"]:
            positions = account.get("snaptrade_positions", [])
            for pos in positions:
                price = pos.get("price", 0) or 0
                units = pos.get("units", 0) or 0
                avg_cost = pos.get("average_purchase_price", 0) or 0
                position_type = pos.get("position_type", "equity")
                
                # Options multiplier
                multiplier = 100 if position_type == "option" else 1
                
                position_value = price * units * multiplier
                cost_basis = avg_cost * units * (1 if position_type == "option" else 1)
                
                total_value += position_value
                total_cost_basis += cost_basis
                positions_count += 1
                
                # Calculate P&L
                if position_type == "option":
                    # For options: current value - cost basis
                    pnl = position_value - cost_basis
                else:
                    # For equities: use open_pnl if available
                    pnl = pos.get("open_pnl") or (position_value - cost_basis)
                total_pnl += pnl
        
        # Record snapshot
        snapshot_service = get_portfolio_snapshot_service()
        await snapshot_service.record_snapshot(
            user_id=user_id,
            total_value=total_value,
            total_cost_basis=total_cost_basis,
            unrealized_pnl=total_pnl,
            positions_count=positions_count,
            accounts_count=accounts_count,
        )
        
        logger.info(f"Recorded portfolio snapshot for user {user_id}: value={total_value}, pnl={total_pnl}")
    except Exception as e:
        logger.error(f"Failed to record portfolio snapshot for user {user_id}: {e}")


@router.post("/accounts", response_model=List[AccountResponse])
async def sync_accounts(
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Sync brokerage accounts
    
    Fetches the latest account list from SnapTrade and saves to database
    """
    try:
        accounts = await service.sync_accounts(current_user_id)
        return [AccountResponse(**acc) for acc in accounts]
    except Exception as e:
        logger.error(f"Failed to sync accounts: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync accounts: {str(e)}",
        )


@router.post("/positions", response_model=MessageResponse)
async def sync_positions(
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    service: SnapTradeService = Depends(get_snaptrade_service),
):
    """
    Sync positions data
    
    Fetches the latest positions data from SnapTrade and saves to database.
    Also records a portfolio snapshot in the background for historical tracking.
    """
    try:
        positions = await service.sync_positions(current_user_id)
        
        # Record portfolio snapshot in background
        background_tasks.add_task(
            record_portfolio_snapshot_background,
            current_user_id,
            service
        )
        
        return MessageResponse(
            message=f"Successfully synced {len(positions)} positions", 
            success=True
        )
    except Exception as e:
        logger.error(f"Failed to sync positions: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync positions: {str(e)}",
        )

