"""Share links: create (signed in), read (anyone; options candidates need sign-in), list, revoke."""

import asyncio
import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_current_user_id, get_optional_user_id
from app.core.supabase import get_supabase_service
from app.services import content_shares as shares

router = APIRouter(prefix="/shares", tags=["Shares"])
logger = logging.getLogger(__name__)
SHARE_ID = Path(pattern=r"^[A-Za-z0-9]{10}$")


class CreateShareRequest(BaseModel):
    kind: shares.ShareKind
    source_id: str = Field(min_length=1, max_length=200)
    locale: Literal["zh", "en"] = "zh"
    # Chat only: a passage the reader selected; the server checks it is part of the answer.
    excerpt: str = Field(default="", max_length=shares.MAX_EXCERPT)
    include_question: bool = True


def _raise(error: shares.ShareError):
    raise HTTPException(status_code=error.status, detail=error.code)


@router.post("", status_code=201)
async def create(body: CreateShareRequest, user_id: str = Depends(get_current_user_id)):
    try:
        row = await asyncio.to_thread(
            shares.create_share,
            get_supabase_service(),
            user_id,
            body.kind,
            body.source_id.strip(),
            body.locale,
            body.excerpt,
            body.include_question,
        )
    except shares.ShareError as error:
        _raise(error)
    except Exception as error:
        logger.exception("Share creation failed: %s", error)
        raise HTTPException(status_code=503, detail="unavailable") from error
    return shares.public_view(row, signed_in=True)


@router.get("")
async def mine(user_id: str = Depends(get_current_user_id)):
    try:
        items = await asyncio.to_thread(shares.list_shares, get_supabase_service(), user_id)
    except Exception as error:
        logger.exception("Share list failed: %s", error)
        raise HTTPException(status_code=503, detail="unavailable") from error
    return {"items": items}


@router.get("/{share_id}")
async def read(
    response: Response,
    share_id: str = SHARE_ID,
    viewer_id: Optional[str] = Depends(get_optional_user_id),
):
    try:
        row = await asyncio.to_thread(shares.get_share, get_supabase_service(), share_id)
    except Exception as error:
        logger.exception("Share read failed: %s", error)
        raise HTTPException(status_code=503, detail="unavailable") from error
    if not row:
        raise HTTPException(status_code=404, detail="not_found")
    if row.get("visibility") == "signed_in":
        response.headers["Cache-Control"] = "private, no-store"
    return shares.public_view(row, signed_in=bool(viewer_id))


@router.delete("/{share_id}")
async def revoke(share_id: str = SHARE_ID, user_id: str = Depends(get_current_user_id)):
    try:
        revoked = await asyncio.to_thread(
            shares.revoke_share, get_supabase_service(), user_id, share_id
        )
    except Exception as error:
        logger.exception("Share revoke failed: %s", error)
        raise HTTPException(status_code=503, detail="unavailable") from error
    if not revoked:
        raise HTTPException(status_code=404, detail="not_found")
    return {"id": share_id, "revoked": True}
