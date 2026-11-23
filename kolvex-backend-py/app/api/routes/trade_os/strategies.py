"""
Trade OS Strategy Routes
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id
from app.services.trade_os.strategy_service import StrategyService

router = APIRouter(prefix="/strategies", tags=["Trade OS Strategies"])


class StrategyVersionCreateRequest(BaseModel):
    strategy_key: str = Field(..., max_length=50)
    version: str = Field(..., max_length=20)
    display_name: str = Field(..., max_length=100)
    description: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    entry_rules: List[Dict[str, Any]] = Field(default_factory=list)
    exit_rules: List[Dict[str, Any]] = Field(default_factory=list)
    risk_rules: Dict[str, Any] = Field(default_factory=dict)
    status: str = Field(default="draft")


def get_strategy_service() -> StrategyService:
    return StrategyService()


@router.get("", response_model=List[Dict[str, Any]])
def list_strategies(
    user_id: str = Depends(get_current_user_id),
    service: StrategyService = Depends(get_strategy_service),
):
    """List all strategy versions for user."""
    return service.get_strategy_versions(user_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_strategy(
    req: StrategyVersionCreateRequest,
    user_id: str = Depends(get_current_user_id),
    service: StrategyService = Depends(get_strategy_service),
):
    """Create a new strategy version with canonical hash."""
    try:
        return service.create_strategy_version(
            user_id=user_id,
            strategy_key=req.strategy_key,
            version=req.version,
            display_name=req.display_name,
            parameters=req.parameters,
            entry_rules=req.entry_rules,
            exit_rules=req.exit_rules,
            risk_rules=req.risk_rules,
            description=req.description,
            status=req.status,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create strategy version: {str(e)}",
        )


@router.get("/{version_id}")
def get_strategy(
    version_id: str,
    user_id: str = Depends(get_current_user_id),
    service: StrategyService = Depends(get_strategy_service),
):
    """Retrieve details for a specific strategy version."""
    strat = service.get_strategy_version(user_id, version_id)
    if not strat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Strategy version not found"
        )
    return strat
