"""13F snapshots stored in Supabase and refreshed after each quarterly filing.

Reads come from `institution_13f_filings` / `institution_13f_holdings`. A
background worker checks each tracked manager's SEC submissions and, when a new
13F-HR (or an amendment to it) appears, fetches the filing, writes it, then maps
every CUSIP to a ticker and rewrites the rows. Supabase calls are synchronous and
run in threads.
"""
import asyncio
import logging
import os
from datetime import datetime, timezone

from app.core.supabase import get_supabase_service

from .client import MANAGERS, sec_client
from .parsers import filings_from, summarize_institution
from .tickers import cusip_tickers

logger = logging.getLogger(__name__)
FILINGS = "institution_13f_filings"
HOLDINGS = "institution_13f_holdings"
HOLDING_FIELDS = ("issuer", "class", "cusip", "ticker", "share_type", "put_call", "value", "shares",
                  "previous_shares", "change", "change_percent", "weight", "activity")
PAGE = 1000  # PostgREST's default max rows per request
CHUNK = 500
# Bump when parsing changes what is stored (2: thousands-denominated tables detected); older rows resync.
SYNC_VERSION = 2
SYNC_INTERVAL = int(os.getenv("SEC_13F_SYNC_INTERVAL_SECONDS", str(6 * 3600)))


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class HoldingsRepository:
    """Thin, synchronous Supabase access; kept separate so the sync logic can be tested without a database."""

    def __init__(self, db=None):
        self._db = db

    @property
    def db(self):
        return self._db or get_supabase_service()

    def latest(self, manager_id):
        rows = (self.db.table(FILINGS).select("*").eq("manager_id", manager_id).eq("complete", True)
                .order("period", desc=True).order("filed", desc=True).limit(1).execute()).data
        return rows[0] if rows else None

    def find(self, accession):
        rows = self.db.table(FILINGS).select("*").eq("accession", accession).limit(1).execute().data
        return rows[0] if rows else None

    def holdings(self, accession):
        rows, start = [], 0
        while True:
            page = (self.db.table(HOLDINGS).select(",".join(HOLDING_FIELDS)).eq("accession", accession)
                    .order("position").range(start, start + PAGE - 1).execute()).data
            rows.extend(page)
            if len(page) < PAGE:
                return rows
            start += PAGE

    def known_tickers(self, cusips):
        """Tickers already stored for these CUSIPs under any manager: a durable map that survives cache loss."""
        unique, known = sorted({c for c in cusips if c}), {}
        for start in range(0, len(unique), 200):
            rows = (self.db.table(HOLDINGS).select("cusip,ticker").in_("cusip", unique[start:start + 200])
                    .not_.is_("ticker", "null").limit(PAGE).execute()).data
            known.update((r["cusip"], r["ticker"]) for r in rows)
        return known

    def save(self, data, mapped):
        """Upserts the filing and all holdings. A first write stays hidden (complete=false) until every row lands;
        a rewrite of an already complete snapshot keeps serving it while the rows update in place."""
        filing, holdings = data["filing"], data["holdings"]
        accession = filing["accession"]
        row = {"accession": accession, "manager_id": data["id"], "manager_name": data["name"], "cik": data["cik"],
               "period": filing["period"], "filed": filing["filed"], "filing": filing,
               "previous_filing": data.get("previous_filing"), "amendments": data.get("amendments") or [],
               "partial": bool(data.get("partial")), "coverage": data.get("coverage"),
               "summary": summarize_institution(data), "holdings_count": len(holdings),
               "sec_fetched_at": data.get("fetched_at") or now_iso(), "synced_at": now_iso(),
               "sync_version": SYNC_VERSION}
        self.db.table(FILINGS).upsert(row, on_conflict="accession").execute()
        rows = [{"accession": accession, "position": i, **{f: h.get(f) for f in HOLDING_FIELDS}} for i, h in enumerate(holdings)]
        for start in range(0, len(rows), CHUNK):
            self.db.table(HOLDINGS).upsert(rows[start:start + CHUNK], on_conflict="accession,position").execute()
        self.db.table(HOLDINGS).delete().eq("accession", accession).gte("position", len(rows)).execute()
        done = {"complete": True}
        if mapped:
            done["tickers_mapped_at"] = now_iso()
        self.db.table(FILINGS).update(done).eq("accession", accession).execute()


def response(row, holdings):
    """The same shape as the live SEC response the frontend already reads."""
    return {"id": row["manager_id"], "name": row["manager_name"], "cik": row["cik"], "source": "SEC EDGAR",
            "fetched_at": row["sec_fetched_at"], "synced_at": row["synced_at"], "filing": row["filing"],
            "previous_filing": row["previous_filing"], "holdings": holdings, "partial": row["partial"],
            "amendments": row["amendments"], "coverage": row["coverage"]}


class InstitutionStore:
    def __init__(self, repo=None, sec=None, tickers=None):
        self.repo = repo or HoldingsRepository()
        self.sec = sec or sec_client
        self.tickers = tickers or cusip_tickers
        self._locks = {}
        self._tasks = {}

    async def latest(self, manager):
        row = await asyncio.to_thread(self.repo.latest, manager)
        if row is None:
            return None
        return response(row, await asyncio.to_thread(self.repo.holdings, row["accession"]))

    async def summary(self, manager):
        row = await asyncio.to_thread(self.repo.latest, manager)
        if row is None:
            return None
        return {**row["summary"], "fetched_at": row["sec_fetched_at"], "synced_at": row["synced_at"]}

    async def _newest(self, manager):
        """Latest original 13F-HR and the amendments filed against its period, from SEC submissions only."""
        filings = filings_from(await self.sec.submissions(MANAGERS[manager]["cik"]))
        current = next((r for r in filings if r["form"] == "13F-HR"), None)
        if current is None:
            return None, set()
        return current, {r["accession"] for r in filings if r["form"] == "13F-HR/A" and r["period"] == current["period"]}

    async def sync(self, manager, force=False, map_all=True):
        """Returns "current", "no_filing", "published" (map_all=False, tickers still filling) or "synced"."""
        lock = self._locks.setdefault(manager, asyncio.Lock())
        async with lock:
            current, amendments = await self._newest(manager)
            if current is None:
                return "no_filing"
            stored = await asyncio.to_thread(self.repo.find, current["accession"])
            stored_amendments = {r["accession"] for r in (stored or {}).get("amendments") or []}
            fresh = bool(stored and stored["complete"] and amendments <= stored_amendments
                         and (stored.get("sync_version") or 1) >= SYNC_VERSION) and not force
            if fresh and (stored["tickers_mapped_at"] or not map_all):
                return "current"
            data = {"id": manager, **await self.sec.institution(manager)}
            if not data.get("filing"):
                return "no_filing"
            holdings = data["holdings"]
            cusips = [h.get("cusip") for h in holdings]
            try:
                await self.tickers.load()
                self.tickers.remember(await asyncio.to_thread(self.repo.known_tickers, cusips))
            except Exception:
                logger.warning("Stored CUSIP tickers unavailable", exc_info=True)
            if not fresh:
                # Publish quickly with the largest positions mapped; the full pass follows.
                await self.tickers.attach(holdings, now=100)
                await asyncio.to_thread(self.repo.save, data, False)
                if not map_all:
                    logger.info("13F %s published: %s, %d holdings", manager, data["filing"]["accession"], len(holdings))
                    return "published"
            await self.tickers.resolve(cusips, wait=True)
            await self.tickers.attach(holdings, now=0)
            await asyncio.to_thread(self.repo.save, data, not self.tickers.pending(cusips))
            logger.info("13F %s synced: %s, %d holdings", manager, data["filing"]["accession"], len(holdings))
            return "synced"

    def sync_later(self, manager):
        """At most one queued sync per manager, however many reads miss."""
        task = self._tasks.get(manager)
        if task is None or task.done():
            self._tasks[manager] = asyncio.create_task(self._sync_quietly(manager))

    async def _sync_quietly(self, manager, **kw):
        try:
            return await self.sync(manager, **kw)
        except Exception:
            logger.warning("13F sync failed for %s", manager, exc_info=True)

    async def sync_all(self, force=False):
        """Publishes every manager first, then fills tickers, so one large filing never delays the rest."""
        for manager in MANAGERS:
            await self._sync_quietly(manager, force=force, map_all=False)
        for manager in MANAGERS:
            await self._sync_quietly(manager)

    async def run_worker(self, interval=SYNC_INTERVAL, delay=30):
        """Checks every tracked manager on an interval; a check is one cached SEC submissions read when nothing changed."""
        await asyncio.sleep(delay)
        while True:
            await self.sync_all()
            await asyncio.sleep(interval)


institution_store = InstitutionStore()
