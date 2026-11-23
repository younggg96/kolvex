"""
Trade OS Import Routes
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services.trade_os.account_service import AccountService
from app.services.trade_os.import_service import ImportService

router = APIRouter(prefix="/imports", tags=["Trade OS Imports"])


def get_import_service() -> ImportService:
    return ImportService()


@router.post("/robinhood-csv/{account_id}")
async def upload_robinhood_csv(
    account_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    import_service: ImportService = Depends(get_import_service),
):
    """
    Upload and process a Robinhood Account Activity CSV file.
    Deduplicates records based on deterministic fingerprinting.
    """
    # Verify account ownership
    account_svc = AccountService()
    account = account_svc.get_account(user_id, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    try:
        content_bytes = await file.read()
        # Decode handling UTF-8 with BOM or plain UTF-8
        try:
            csv_text = content_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            csv_text = content_bytes.decode("latin-1")

        result = import_service.process_csv_import(
            user_id=user_id,
            account_id=account_id,
            csv_text=csv_text,
            file_name=file.filename or "robinhood_activity.csv",
            source="robinhood_csv",
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Import processing failed: {str(e)}",
        )


@router.get("/batches/{account_id}", response_model=List[Dict[str, Any]])
def list_import_batches(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List recent import batches for an account."""
    db = get_supabase_service()
    res = (
        db.table("import_batches")
        .select("*")
        .eq("account_id", account_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return res.data or []


@router.get("/issues/{account_id}", response_model=List[Dict[str, Any]])
def list_reconciliation_issues(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """List unresolved reconciliation issues for an account."""
    db = get_supabase_service()
    res = (
        db.table("reconciliation_issues")
        .select("*")
        .eq("account_id", account_id)
        .eq("user_id", user_id)
        .eq("resolution", "pending")
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    return res.data or []
