"""
Trade OS Journal API Routes
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.trade_os.journal_service import get_journal_entries, save_journal_review

router = APIRouter(prefix="/journal", tags=["Trade OS Journal"])


class ReviewSubmissionRequest(BaseModel):
    trade_group_id: str
    execution_rating: str = "good"
    discipline_score: int = 5
    mistake_tags: Optional[List[str]] = None
    notes: Optional[str] = None


@router.get("/{account_id}")
async def fetch_journal(account_id: str) -> List[Dict[str, Any]]:
    """Returns reconciled journal items for an account."""
    try:
        return await get_journal_entries(account_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/review")
async def submit_review(body: ReviewSubmissionRequest) -> Dict[str, Any]:
    """Saves user review and generates structured retrospective review."""
    try:
        return await save_journal_review(
            trade_group_id=body.trade_group_id,
            execution_rating=body.execution_rating,
            discipline_score=body.discipline_score,
            mistake_tags=body.mistake_tags,
            notes=body.notes,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
