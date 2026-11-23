"""
Trade OS Import Service

Orchestrates CSV and manual trade ingestion:
Upload -> Parse -> Normalize -> Deduplicate -> Match/Reconcile -> Persist -> Audit
"""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from app.core.supabase import get_supabase_service
from app.services.trade_os.decimal_utils import ZERO
from app.services.trade_os.parsers.robinhood import parse_robinhood_csv
from app.services.trade_os.reconciliation import group_executions_fifo

logger = logging.getLogger(__name__)


class ImportService:
    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_service()

    def process_csv_import(
        self,
        user_id: str,
        account_id: str,
        csv_text: str,
        file_name: str = "activity.csv",
        source: str = "robinhood_csv",
    ) -> Dict[str, Any]:
        """
        Execute full CSV import pipeline.
        Idempotent: deduplicates executions based on source_execution_id.
        """
        file_hash = hashlib.sha256(csv_text.encode("utf-8")).hexdigest()

        # 1. Create Import Batch
        batch_id = str(uuid4())
        batch_record = {
            "id": batch_id,
            "account_id": account_id,
            "user_id": user_id,
            "source": source,
            "file_name": file_name,
            "file_hash": file_hash,
            "record_count": 0,
            "imported_count": 0,
            "duplicate_count": 0,
            "error_count": 0,
            "status": "processing",
            "errors": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.supabase.table("import_batches").insert(batch_record).execute()

        try:
            # 2. Parse file
            if source == "robinhood_csv":
                parsed = parse_robinhood_csv(csv_text, default_account_id=account_id)
            else:
                raise ValueError(f"Unsupported import source: {source}")

            raw_executions = parsed["executions"]
            raw_cash_flows = parsed["cash_flows"]
            unparsed = parsed["unparsed_rows"]

            total_records = len(raw_executions) + len(raw_cash_flows) + len(unparsed)

            # 3. Deduplicate Executions against database
            existing_exec_ids = set()
            if raw_executions:
                exec_source_ids = [e["source_execution_id"] for e in raw_executions]
                # Batch query existing source_execution_ids for this account
                # Query in chunks of 500
                chunk_size = 500
                for i in range(0, len(exec_source_ids), chunk_size):
                    chunk = exec_source_ids[i : i + chunk_size]
                    res = (
                        self.supabase.table("executions")
                        .select("source_execution_id")
                        .eq("account_id", account_id)
                        .in_("source_execution_id", chunk)
                        .execute()
                    )
                    if res.data:
                        existing_exec_ids.update(row["source_execution_id"] for row in res.data)

            new_executions: List[Dict[str, Any]] = []
            duplicate_executions: List[Dict[str, Any]] = []

            for ex in raw_executions:
                if ex["source_execution_id"] in existing_exec_ids:
                    duplicate_executions.append(ex)
                else:
                    new_executions.append(ex)

            # 4. Insert new executions
            inserted_executions = []
            if new_executions:
                db_exec_payloads = []
                for ex in new_executions:
                    db_exec_payloads.append(
                        {
                            "account_id": account_id,
                            "user_id": user_id,
                            "import_batch_id": batch_id,
                            "source_execution_id": ex["source_execution_id"],
                            "symbol": ex["symbol"],
                            "side": ex["side"],
                            "quantity": float(ex["quantity"]),
                            "price": float(ex["price"]),
                            "amount": float(ex["amount"]),
                            "fees": float(ex.get("fees", ZERO)),
                            "executed_at": ex["executed_at"].isoformat()
                            if isinstance(ex["executed_at"], datetime)
                            else str(ex["executed_at"]),
                            "activity_type": ex.get("activity_type", "trade"),
                            "instrument_type": ex.get("instrument_type", "equity"),
                            "description": ex.get("description", ""),
                            "source": source,
                            "quality_status": "confirmed",
                        }
                    )

                # Insert in chunks of 200
                for i in range(0, len(db_exec_payloads), 200):
                    chunk = db_exec_payloads[i : i + 200]
                    res = self.supabase.table("executions").insert(chunk).execute()
                    if res.data:
                        inserted_executions.extend(res.data)

            # 5. Insert cash flows (ignore on conflict / deduplicate)
            inserted_cash_flows = []
            if raw_cash_flows:
                cf_payloads = []
                for cf in raw_cash_flows:
                    cf_payloads.append(
                        {
                            "account_id": account_id,
                            "user_id": user_id,
                            "source_id": cf["source_id"],
                            "flow_type": cf["flow_type"],
                            "amount": float(cf["amount"]),
                            "effective_date": str(cf["effective_date"]),
                            "description": cf.get("description", ""),
                            "source": source,
                        }
                    )

                for i in range(0, len(cf_payloads), 200):
                    chunk = cf_payloads[i : i + 200]
                    res = self.supabase.table("cash_flows").insert(chunk).execute()
                    if res.data:
                        inserted_cash_flows.extend(res.data)

            # 6. Reconcile trade groups across all account executions
            all_account_execs = (
                self.supabase.table("executions")
                .select("*")
                .eq("account_id", account_id)
                .order("executed_at", desc=False)
                .execute()
            ).data or []

            trade_groups, issues = group_executions_fifo(all_account_execs)

            # Persist trade groups
            # First clean existing unlinked groups or update
            # For simplicity and reproducibility, remove and replace auto-generated trade groups
            self.supabase.table("trade_groups").delete().eq("account_id", account_id).execute()

            for tg in trade_groups:
                tg_id = str(uuid4())
                tg_payload = {
                    "id": tg_id,
                    "account_id": account_id,
                    "user_id": user_id,
                    "symbol": tg["symbol"],
                    "side": tg["side"],
                    "status": tg["status"],
                    "open_quantity": float(tg["open_quantity"]),
                    "total_buy_quantity": float(tg["total_buy_quantity"]),
                    "total_sell_quantity": float(tg["total_sell_quantity"]),
                    "average_entry_price": float(tg["average_entry_price"]),
                    "realized_pnl": float(tg["realized_pnl"]),
                    "total_fees": float(tg["total_fees"]),
                    "first_entry_at": tg["first_entry_at"].isoformat()
                    if isinstance(tg["first_entry_at"], datetime)
                    else str(tg["first_entry_at"]),
                    "last_activity_at": tg["last_activity_at"].isoformat()
                    if isinstance(tg["last_activity_at"], datetime)
                    else str(tg["last_activity_at"]),
                    "closed_at": tg["closed_at"].isoformat()
                    if isinstance(tg.get("closed_at"), datetime)
                    else None,
                }
                self.supabase.table("trade_groups").insert(tg_payload).execute()

            # Record reconciliation issues
            all_issues = []
            for unp in unparsed:
                all_issues.append(
                    {
                        "account_id": account_id,
                        "user_id": user_id,
                        "import_batch_id": batch_id,
                        "issue_type": "unparsed_row",
                        "description": unp.get("reason", "Could not parse CSV row"),
                        "raw_data": unp.get("raw"),
                        "resolution": "pending",
                    }
                )
            for iss in issues:
                all_issues.append(
                    {
                        "account_id": account_id,
                        "user_id": user_id,
                        "import_batch_id": batch_id,
                        "issue_type": iss["issue_type"],
                        "symbol": iss.get("symbol"),
                        "description": iss["description"],
                        "raw_data": iss.get("raw_data"),
                        "resolution": "pending",
                    }
                )

            if all_issues:
                for i in range(0, len(all_issues), 100):
                    self.supabase.table("reconciliation_issues").insert(
                        all_issues[i : i + 100]
                    ).execute()

            # 7. Update Batch record
            batch_update = {
                "record_count": total_records,
                "imported_count": len(inserted_executions) + len(inserted_cash_flows),
                "duplicate_count": len(duplicate_executions),
                "error_count": len(all_issues),
                "status": "completed",
            }
            self.supabase.table("import_batches").update(batch_update).eq("id", batch_id).execute()

            # 8. Record Audit Log
            self.supabase.table("trade_os_audit_logs").insert(
                {
                    "user_id": user_id,
                    "entity_type": "import_batch",
                    "entity_id": batch_id,
                    "action": "import",
                    "new_values": {
                        "account_id": account_id,
                        "file_name": file_name,
                        "imported_executions": len(inserted_executions),
                        "duplicate_executions": len(duplicate_executions),
                        "cash_flows": len(inserted_cash_flows),
                        "issues_count": len(all_issues),
                    },
                }
            ).execute()

            return {
                "batch_id": batch_id,
                "status": "completed",
                "imported_executions_count": len(inserted_executions),
                "duplicate_executions_count": len(duplicate_executions),
                "cash_flows_count": len(inserted_cash_flows),
                "issues_count": len(all_issues),
                "trade_groups_count": len(trade_groups),
            }

        except Exception as e:
            logger.exception("CSV import failed for batch %s", batch_id)
            self.supabase.table("import_batches").update(
                {
                    "status": "failed",
                    "errors": {"error": str(e)},
                }
            ).eq("id", batch_id).execute()
            raise
