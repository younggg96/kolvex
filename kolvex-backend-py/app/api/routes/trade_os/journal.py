"""
Trade OS Journal API Routes
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies.auth import get_current_user_id
from app.api.routes.trade_os.ownership import ensure_owned_trade_group, require_owned_account
from app.services.trade_os.journal_service import get_journal_entries, save_journal_review

router = APIRouter(prefix="/journal", tags=["Trade OS Journal"])


class ReviewSubmissionRequest(BaseModel):
    trade_group_id: str
    execution_rating: str = "good"
    discipline_score: int = 5
    mistake_tags: Optional[List[str]] = None
    notes: Optional[str] = None


@router.get("/{account_id}")
async def fetch_journal(
    account_id: str, _user_id: str = Depends(require_owned_account)
) -> List[Dict[str, Any]]:
    """Returns reconciled journal items for an account the caller owns."""
    try:
        return await get_journal_entries(account_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/review")
async def submit_review(
    body: ReviewSubmissionRequest, user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Saves the caller's review of their own trade group."""
    await ensure_owned_trade_group(body.trade_group_id, user_id)
    try:
        return await save_journal_review(
            trade_group_id=body.trade_group_id,
            execution_rating=body.execution_rating,
            discipline_score=body.discipline_score,
            mistake_tags=body.mistake_tags,
            notes=body.notes,
            user_id=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
