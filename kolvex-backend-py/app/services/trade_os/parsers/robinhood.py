"""
Robinhood Account Activity CSV Parser

Parses official Robinhood Account Activity CSV exports into normalized records:
Columns:
  Activity Date, Process Date, Settle Date, Instrument, Description, Trans Code, Quantity, Price, Amount
"""

import csv
import hashlib
import io
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, DecimalError, d


class RobinhoodParseError(ValueError):
    """Raised when the CSV structure is fundamentally unreadable."""

    pass


def _normalize_header(header: str) -> str:
    """Normalize column header names to lowercase without spaces or underscores."""
    return re.sub(r"[^a-z0-9]", "", header.lower())


def _parse_date(date_str: str) -> Optional[datetime]:
    """Parse date strings like MM/DD/YYYY, YYYY-MM-DD, M/D/YYYY into UTC datetime."""
    clean = date_str.strip()
    if not clean:
        return None

    formats = [
        "%m/%d/%Y",
        "%Y-%m-%d",
        "%m/%d/%y",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    # Try ISO format
    try:
        return datetime.fromisoformat(clean).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def parse_robinhood_csv(
    csv_content: str,
    default_account_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Parse Robinhood CSV text into structured records:
    - executions: list of trade / option executions
    - cash_flows: list of deposits, withdrawals, dividends, interest
    - unparsed_rows: list of unparseable or unrecognized rows with error reasons
    - summary: counts of processed records
    """
    if not csv_content or not csv_content.strip():
        raise RobinhoodParseError("CSV content is empty")

    # Read CSV
    stream = io.StringIO(csv_content.strip())
    reader = csv.reader(stream)

    try:
        raw_headers = next(reader)
    except StopIteration:
        raise RobinhoodParseError("CSV contains no rows")

    # Check headers
    norm_headers = [_normalize_header(h) for h in raw_headers]
    header_map: Dict[str, int] = {h: idx for idx, h in enumerate(norm_headers) if h}

    # Required fields
    required_candidates = {
        "activitydate": ["activitydate", "date"],
        "transcode": ["transcode", "type", "transactioncode"],
        "amount": ["amount", "netamount", "total"],
    }

    resolved_cols: Dict[str, int] = {}
    for canonical_name, candidates in required_candidates.items():
        found = False
        for c in candidates:
            if c in header_map:
                resolved_cols[canonical_name] = header_map[c]
                found = True
                break
        if not found:
            raise RobinhoodParseError(
                f"Missing required CSV column. Expected one of {candidates}, got {raw_headers}"
            )

    # Optional columns
    instrument_idx = header_map.get("instrument") or header_map.get("symbol")
    desc_idx = header_map.get("description")
    qty_idx = header_map.get("quantity") or header_map.get("shares")
    price_idx = header_map.get("price") or header_map.get("shareprice")

    executions: List[Dict[str, Any]] = []
    cash_flows: List[Dict[str, Any]] = []
    unparsed_rows: List[Dict[str, Any]] = []

    row_index = 0
    for row in reader:
        row_index += 1
        if not row or all(not cell.strip() for cell in row):
            continue

        raw_row_dict = {
            raw_headers[i] if i < len(raw_headers) else f"col_{i}": cell.strip()
            for i, cell in enumerate(row)
        }

        try:
            act_date_str = row[resolved_cols["activitydate"]].strip()
            trans_code_raw = row[resolved_cols["transcode"]].strip().upper()
            amount_str = row[resolved_cols["amount"]].strip()

            act_date = _parse_date(act_date_str)
            if not act_date:
                unparsed_rows.append(
                    {
                        "row_index": row_index,
                        "reason": f"Invalid activity date: {act_date_str}",
                        "raw": raw_row_dict,
                    }
                )
                continue

            amount = d(amount_str)

            # Instrument / ticker
            instrument = ""
            if instrument_idx is not None and instrument_idx < len(row):
                instrument = row[instrument_idx].strip().upper()

            # Description
            desc = ""
            if desc_idx is not None and desc_idx < len(row):
                desc = row[desc_idx].strip()

            # Quantity and Price
            qty: Optional[Decimal] = None
            if qty_idx is not None and qty_idx < len(row) and row[qty_idx].strip():
                try:
                    qty = abs(d(row[qty_idx]))
                except DecimalError:
                    qty = None

            price: Optional[Decimal] = None
            if price_idx is not None and price_idx < len(row) and row[price_idx].strip():
                try:
                    price = abs(d(row[price_idx]))
                except DecimalError:
                    price = None

            # Generate deterministic fingerprint
            fp_content = f"{act_date_str}|{trans_code_raw}|{instrument}|{qty or ''}|{price or ''}|{amount}|{desc}|{row_index}"
            source_id = "rh_" + hashlib.sha256(fp_content.encode("utf-8")).hexdigest()[:24]

            # Classify transaction code
            # 1. Equity trades
            if trans_code_raw in ("BUY", "B"):
                side = "buy"
                exec_qty = qty or (abs(amount / price) if price and price > ZERO else ZERO)
                exec_price = price or (
                    abs(amount / exec_qty) if exec_qty and exec_qty > ZERO else ZERO
                )
                executions.append(
                    {
                        "source_execution_id": source_id,
                        "symbol": instrument,
                        "side": side,
                        "quantity": exec_qty,
                        "price": exec_price,
                        "amount": abs(amount),
                        "fees": ZERO,
                        "executed_at": act_date,
                        "activity_type": "trade",
                        "instrument_type": "equity",
                        "description": desc,
                        "source": "robinhood_csv",
                    }
                )

            elif trans_code_raw in ("SELL", "S"):
                side = "sell"
                exec_qty = qty or (abs(amount / price) if price and price > ZERO else ZERO)
                exec_price = price or (
                    abs(amount / exec_qty) if exec_qty and exec_qty > ZERO else ZERO
                )
                executions.append(
                    {
                        "source_execution_id": source_id,
                        "symbol": instrument,
                        "side": side,
                        "quantity": exec_qty,
                        "price": exec_price,
                        "amount": abs(amount),
                        "fees": ZERO,
                        "executed_at": act_date,
                        "activity_type": "trade",
                        "instrument_type": "equity",
                        "description": desc,
                        "source": "robinhood_csv",
                    }
                )

            # 2. Options trades
            elif trans_code_raw in ("BTO", "BTC", "STO", "STC"):
                side = "buy" if trans_code_raw in ("BTO", "BTC") else "sell"
                executions.append(
                    {
                        "source_execution_id": source_id,
                        "symbol": instrument or "OPTION",
                        "side": side,
                        "quantity": qty or Decimal("1"),
                        "price": price or ZERO,
                        "amount": abs(amount),
                        "fees": ZERO,
                        "executed_at": act_date,
                        "activity_type": "option",
                        "instrument_type": "option",
                        "description": f"{trans_code_raw} {desc}".strip(),
                        "source": "robinhood_csv",
                    }
                )

            # 3. Dividends
            elif trans_code_raw in ("CDIV", "DIV"):
                cash_flows.append(
                    {
                        "source_id": source_id,
                        "flow_type": "dividend",
                        "amount": abs(amount),
                        "effective_date": act_date.date(),
                        "description": desc or f"Dividend from {instrument}",
                        "source": "robinhood_csv",
                    }
                )

            # 4. Cash deposits & withdrawals
            elif trans_code_raw in ("ACH", "FT", "DEPOSIT", "WITHDRAWAL"):
                flow_type = "deposit" if amount >= ZERO else "withdrawal"
                cash_flows.append(
                    {
                        "source_id": source_id,
                        "flow_type": flow_type,
                        "amount": abs(amount),
                        "effective_date": act_date.date(),
                        "description": desc or trans_code_raw,
                        "source": "robinhood_csv",
                    }
                )

            # 5. Interest / Fees / Gold
            elif trans_code_raw in ("INT", "GOLD", "FEE"):
                flow_type = "interest" if amount >= ZERO else "fee"
                cash_flows.append(
                    {
                        "source_id": source_id,
                        "flow_type": flow_type,
                        "amount": abs(amount),
                        "effective_date": act_date.date(),
                        "description": desc or trans_code_raw,
                        "source": "robinhood_csv",
                    }
                )

            # 6. Corporate actions like Splits or Expired options
            elif trans_code_raw in ("SPL", "OEXP", "OASGN", "OEXC"):
                unparsed_rows.append(
                    {
                        "row_index": row_index,
                        "reason": f"Corporate action/option event ({trans_code_raw}) requiring review",
                        "raw": raw_row_dict,
                    }
                )

            else:
                unparsed_rows.append(
                    {
                        "row_index": row_index,
                        "reason": f"Unrecognized transaction code: {trans_code_raw}",
                        "raw": raw_row_dict,
                    }
                )

        except Exception as e:
            unparsed_rows.append(
                {
                    "row_index": row_index,
                    "reason": f"Row parsing exception: {str(e)}",
                    "raw": raw_row_dict,
                }
            )

    return {
        "executions": executions,
        "cash_flows": cash_flows,
        "unparsed_rows": unparsed_rows,
        "summary": {
            "total_rows": row_index,
            "executions_count": len(executions),
            "cash_flows_count": len(cash_flows),
            "unparsed_count": len(unparsed_rows),
        },
    }
