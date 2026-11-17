"""Admin editing of the Superinvestors coverage list (`institution_managers`)."""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.dependencies.auth import verify_admin
from app.services.sec.client import SecUnavailable, sec_client
from app.services.sec.holdings_store import institution_store
from app.services.sec.managers import ID_PATTERN, TablesMissing, manager_registry
from app.services.sec.parsers import filings_from

router = APIRouter(prefix="/institutions", tags=["Admin"])
Category = Literal["classic", "chinese", "value", "activist", "growth", "other"]


def clean(value):
    if value is None:
        return None
    value = " ".join(str(value).split())
    return value or None


class ManagerFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(default=None, max_length=120)
    zh_name: Optional[str] = Field(default=None, max_length=80)
    person_en: Optional[str] = Field(default=None, max_length=80)
    person_zh: Optional[str] = Field(default=None, max_length=80)
    role_en: Optional[str] = Field(default=None, max_length=60)
    role_zh: Optional[str] = Field(default=None, max_length=60)
    category: Optional[Category] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = Field(default=None, ge=0, le=100000)

    @field_validator("name", "zh_name", "person_en", "person_zh", "role_en", "role_zh")
    @classmethod
    def strip(cls, value):
        return clean(value)


class ManagerCreate(ManagerFields):
    id: str
    cik: int = Field(gt=0, lt=10**10)
    name: str = Field(max_length=120)

    @field_validator("id")
    @classmethod
    def valid_id(cls, value):
        value = value.strip().lower()
        if not ID_PATTERN.match(value):
            raise ValueError(
                "id must be 2-40 lowercase letters, digits or underscores, starting with a letter"
            )
        return value


async def sec_identity(cik: int) -> Dict[str, Any]:
    """What SEC EDGAR says about a CIK: entity name and its 13F-HR history. 404/422/503 when unusable."""
    try:
        submissions = await sec_client.submissions(cik)
    except SecUnavailable as exc:
        # A CIK EDGAR does not know answers 404, which the client reports as unavailable too.
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "sec_unavailable_or_unknown_cik"
        ) from exc
    filings = [r for r in filings_from(submissions) if r["form"] == "13F-HR"]
    return {
        "cik": cik,
        "sec_name": submissions.get("name"),
        "latest_13f": filings[0] if filings else None,
        "filings_13f": len(filings),
    }


async def run(fn, *args):
    try:
        return await asyncio.to_thread(fn, *args)
    except TablesMissing as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "tables_missing") from exc


async def changed():
    """Make the edit visible on this instance now; other instances pick it up on their next refresh."""
    await asyncio.to_thread(manager_registry.refresh)


@router.get("")
async def list_managers(admin_id: str = Depends(verify_admin)) -> Dict[str, Any]:
    rows = await run(manager_registry.repo.all)
    return {"managers": rows, "serving": manager_registry.source, "enabled": len(manager_registry)}


@router.get("/lookup")
async def lookup(
    cik: int = Query(gt=0, lt=10**10), admin_id: str = Depends(verify_admin)
) -> Dict[str, Any]:
    identity = await sec_identity(cik)
    existing = await run(manager_registry.repo.find, None, cik)
    return {**identity, "existing_id": existing["id"] if existing else None}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_manager(
    body: ManagerCreate, admin_id: str = Depends(verify_admin)
) -> Dict[str, Any]:
    if await run(manager_registry.repo.find, body.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "id_taken")
    if await run(manager_registry.repo.find, None, body.cik):
        raise HTTPException(status.HTTP_409_CONFLICT, "cik_taken")
    identity = await sec_identity(body.cik)
    if not identity["latest_13f"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "no_13f_filings")
    row = body.model_dump(exclude_none=True)
    row.setdefault("category", "other")
    row.setdefault("enabled", True)
    row["updated_by"] = admin_id
    created = await run(manager_registry.repo.insert, row)
    await changed()
    if created.get("enabled"):
        institution_store.sync_later(created["id"])
    return {"manager": created, "sec": identity}


@router.patch("/{manager_id}")
async def update_manager(
    manager_id: str, body: ManagerFields, admin_id: str = Depends(verify_admin)
) -> Dict[str, Any]:
    values = body.model_dump(exclude_unset=True)
    if "name" in values and not values["name"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "name_required")
    for key in (
        "category",
        "enabled",
        "sort_order",
    ):  # NOT NULL columns: an explicit null means "leave as is"
        if key in values and values[key] is None:
            values.pop(key)
    if not values:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "nothing_to_update")
    values["updated_at"] = datetime.now(timezone.utc).isoformat()
    values["updated_by"] = admin_id
    updated = await run(manager_registry.repo.update, manager_id, values)
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "manager_not_found")
    await changed()
    if updated.get("enabled"):
        # Covers a newly enabled candidate; for one already stored this is a cheap "current" check.
        institution_store.sync_later(manager_id)
    return {"manager": updated}
