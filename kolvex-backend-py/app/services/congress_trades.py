"""Import CongressInvests disclosures as one atomic snapshot."""
import asyncio
import logging
import re
from datetime import date, datetime, timedelta, timezone

import httpx

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)
URL = "https://congressinfor-production.up.railway.app/trades"
SYNC_INTERVAL = 24 * 3600
PAGE_SIZE = 1000
MAX_PAGES = 20
FILING_URL = re.compile(
    r"https://(?:disclosures-clerk\.house\.gov/public_disc/ptr-pdfs/\d{4}/\d+\.pdf"
    r"|efdsearch\.senate\.gov/search/view/ptr/[0-9a-fA-F-]{36}/?)"
)


def _field(row, key):
    value = row.get(key)
    return (value.strip() or None) if isinstance(value, str) else None


def _normalize(row, today: date):
    try:
        filed = date.fromisoformat(_field(row, "disclosed") or "")
        traded = date.fromisoformat(_field(row, "tx_date") or "")
    except ValueError:
        return None
    member = _field(row, "member")
    transaction = _field(row, "trade_type")
    chamber = (_field(row, "chamber") or "").lower()
    if not member or not transaction or chamber not in ("house", "senate") or not traded <= filed <= today:
        return None

    kind = transaction.lower()
    direction = "other"
    if kind.startswith(("purchase", "buy")):
        direction = "buy"
    elif kind.startswith(("sale", "sell")):
        direction = "sell"
    elif kind.startswith("exchange"):
        direction = "exchange"

    ticker = _field(row, "ticker")
    link = _field(row, "link")
    return {
        "member_name": member,
        "chamber": chamber,
        "ticker": ticker.upper() if ticker else None,
        "asset_name": _field(row, "asset"),
        "trade_date": traded.isoformat(),
        "filed_date": filed.isoformat(),
        "direction": direction,
        "transaction_type": transaction,
        "amount_range": _field(row, "amount"),
        "source_url": link if link and FILING_URL.fullmatch(link) else None,
    }


def sync_congress_trades():
    started = datetime.now(timezone.utc)
    today = started.date()
    cutoff = (today - timedelta(days=365)).isoformat()
    rows = []
    rejected = 0
    snapshot = None
    offset = 0
    with httpx.Client(timeout=20) as client:
        for _ in range(MAX_PAGES):
            response = client.get(URL, params={"limit": PAGE_SIZE, "offset": offset})
            response.raise_for_status()
            data = response.json()
            records = data.get("trades")
            total = data.get("total")
            updated_at = data.get("last_updated")
            has_more = data.get("has_more")
            if (data.get("data_current") is not True or not isinstance(records, list)
                    or type(total) is not int or not updated_at or type(has_more) is not bool
                    or data.get("offset") != offset):
                raise ValueError("CongressInvests returned an incomplete or stale page")
            if snapshot is None:
                snapshot = (updated_at, total)
            elif snapshot != (updated_at, total):
                raise ValueError("CongressInvests refreshed during pagination")
            offset += len(records)
            if offset > total or has_more != (offset < total) or (has_more and not records):
                raise ValueError("CongressInvests pagination is inconsistent")
            for record in records:
                row = _normalize(record, today)
                if row is None:
                    rejected += 1
                elif row["filed_date"] >= cutoff:
                    rows.append(row)
            if not has_more:
                break
        else:
            raise ValueError("CongressInvests pagination exceeded the sync limit")

    if not rows:
        raise ValueError("CongressInvests returned no usable recent disclosures")
    db = get_supabase_service()
    updated = db.rpc("replace_congress_trades", {
        "snapshot": rows, "fetched_at": started.isoformat()
    }).execute().data
    if updated:
        logger.info("Synced %s congressional trades; skipped %s invalid records", len(rows), rejected)
        return len(rows)


async def run_congress_trades_worker():
    while True:
        delay = SYNC_INTERVAL
        try:
            await asyncio.to_thread(sync_congress_trades)
        except Exception:
            logger.exception("Congress trades sync failed")
            delay = 3600
        await asyncio.sleep(delay)
