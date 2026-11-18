import asyncio
import itertools
import unittest

from pydantic import ValidationError

from app.services.portfolio.manual_import import (
    ManualImportRequest,
    ManualImportService,
    ManualImportUnavailable,
    manual_account_key,
)
from app.services.portfolio.service import PortfolioService

_ids = itertools.count(1)
UNIQUE = {
    "portfolio_connections": ("user_id", "provider"),
    "portfolio_accounts": ("connection_id", "account_id"),
    "portfolio_positions": ("account_id", "symbol", "position_type"),
}


class Result:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class Query:
    """Just enough of the supabase-py query builder for these services."""

    def __init__(self, db, table):
        self.db, self.table, self.filters = db, table, []
        self.op, self.payload, self.embed, self.count = "select", None, False, None

    def select(self, columns="*", count=None):
        self.embed = "portfolio_positions(" in columns
        self.count = count
        return self

    def insert(self, data):
        self.op, self.payload = "insert", data
        return self

    def upsert(self, data, on_conflict=None):
        self.op, self.payload = "upsert", data
        return self

    def update(self, data):
        self.op, self.payload = "update", data
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, key, value):
        self.filters.append(lambda row: row.get(key) == value)
        return self

    def neq(self, key, value):
        self.filters.append(lambda row: row.get(key) != value)
        return self

    def in_(self, key, values):
        self.filters.append(lambda row: row.get(key) in values)
        return self

    def limit(self, _):
        return self

    def single(self):
        self.single_row = True
        return self

    def _rows(self):
        return [r for r in self.db[self.table] if all(f(r) for f in self.filters)]

    def execute(self):
        rows = self.db[self.table]
        if self.op == "insert":
            row = {"id": f"id{next(_ids)}", "is_hidden": False, **self.payload}
            rows.append(row)
            return Result([row])
        if self.op == "upsert":
            keys = UNIQUE[self.table]
            match = next((r for r in rows if all(r.get(k) == self.payload[k] for k in keys)), None)
            if match:
                match.update(self.payload)
                return Result([match])
            row = {"id": f"id{next(_ids)}", "is_hidden": False, **self.payload}
            rows.append(row)
            return Result([row])
        matched = self._rows()
        if self.op == "update":
            for row in matched:
                row.update(self.payload)
            return Result(matched)
        if self.op == "delete":
            self.db[self.table] = [r for r in rows if r not in matched]
            if self.table == "portfolio_connections":
                gone = {r["id"] for r in matched}
                self.db["portfolio_accounts"] = [
                    a for a in self.db["portfolio_accounts"] if a["connection_id"] not in gone
                ]
            if self.table in ("portfolio_connections", "portfolio_accounts"):
                live = {a["id"] for a in self.db["portfolio_accounts"]}
                self.db["portfolio_positions"] = [
                    p for p in self.db["portfolio_positions"] if p["account_id"] in live
                ]
            return Result(matched)
        out = [dict(r) for r in matched]
        if self.embed:
            for row in out:
                row["portfolio_positions"] = [
                    dict(p) for p in self.db["portfolio_positions"] if p["account_id"] == row["id"]
                ]
        if getattr(self, "single_row", False):
            return Result(out[0] if out else None)
        return Result(out, count=len(out))


class FakeSupabase:
    def __init__(self):
        self.db = {name: [] for name in UNIQUE}

    def table(self, name):
        return Query(self.db, name)


def payload(**overrides):
    base = {
        "accounts": [
            {
                "name": "Schwab",
                "brokerage": "Charles Schwab",
                "positions": [
                    {"symbol": "nvda", "quantity": 10, "average_cost": 100, "price": 150},
                    {"symbol": "AAPL", "quantity": 5, "average_cost": 200},
                    {
                        "symbol": "AAPL call",
                        "type": "option",
                        "underlying": "aapl",
                        "option_type": "C",
                        "strike": 250,
                        "expiration": "2027-01-15",
                        "quantity": 2,
                        "average_cost": 10,
                        "price": 12,
                    },
                ],
            }
        ]
    }
    base.update(overrides)
    return ManualImportRequest.model_validate(base)


async def quote(symbol):
    if symbol == "AAPL":
        return {"current_price": 210.0}
    raise RuntimeError("no quote")


def run(coro):
    return asyncio.run(coro)


class ValidationTests(unittest.TestCase):
    def test_rejects_zero_quantity_and_bad_ticker(self):
        with self.assertRaises(ValidationError):
            ManualImportRequest.model_validate(
                {"accounts": [{"name": "A", "positions": [{"symbol": "NVDA", "quantity": 0}]}]}
            )
        with self.assertRaises(ValidationError):
            ManualImportRequest.model_validate(
                {"accounts": [{"name": "A", "positions": [{"symbol": "$$$", "quantity": 1}]}]}
            )

    def test_rejects_duplicate_rows_and_incomplete_options(self):
        with self.assertRaises(ValidationError):
            ManualImportRequest.model_validate(
                {
                    "accounts": [
                        {
                            "name": "A",
                            "positions": [
                                {"symbol": "NVDA", "quantity": 1},
                                {"symbol": "nvda", "quantity": 2},
                            ],
                        }
                    ]
                }
            )
        with self.assertRaises(ValidationError):
            ManualImportRequest.model_validate(
                {
                    "accounts": [
                        {
                            "name": "A",
                            "positions": [{"symbol": "X", "type": "option", "quantity": 1}],
                        }
                    ]
                }
            )

    def test_option_symbol_is_occ_style(self):
        option = payload().accounts[0].positions[2]
        self.assertEqual(option.storage_symbol, "AAPL270115C00250000")


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.supabase = FakeSupabase()
        self.service = ManualImportService(self.supabase, quote_fetcher=quote)

    def test_import_creates_manual_connection_and_prices(self):
        result = run(self.service.import_holdings("u1", payload()))
        self.assertEqual(result["positions_count"], 3)
        self.assertEqual(result["unpriced_symbols"], [])
        [conn] = self.supabase.db["portfolio_connections"]
        self.assertEqual(conn["provider"], "manual")
        positions = {p["symbol"]: p for p in self.supabase.db["portfolio_positions"]}
        self.assertEqual(positions["NVDA"]["open_pnl"], 500)
        # Missing price comes from the live quote, never invented.
        self.assertEqual(positions["AAPL"]["price"], 210.0)
        self.assertEqual(positions["AAPL270115C00250000"]["open_pnl"], 400)

    def test_failed_quote_leaves_position_unpriced(self):
        request = ManualImportRequest.model_validate(
            {
                "accounts": [
                    {
                        "name": "A",
                        "positions": [{"symbol": "TSLA", "quantity": 1, "average_cost": 5}],
                    }
                ]
            }
        )
        result = run(self.service.import_holdings("u1", request))
        self.assertEqual(result["unpriced_symbols"], ["TSLA"])
        [position] = self.supabase.db["portfolio_positions"]
        self.assertIsNone(position["price"])
        self.assertIsNone(position["open_pnl"])

    def test_reimport_replaces_but_keeps_row_ids_and_visibility(self):
        run(self.service.import_holdings("u1", payload()))
        nvda = next(p for p in self.supabase.db["portfolio_positions"] if p["symbol"] == "NVDA")
        nvda["is_hidden"] = True
        second = ManualImportRequest.model_validate(
            {
                "accounts": [
                    {
                        "name": "schwab",
                        "positions": [{"symbol": "NVDA", "quantity": 20, "price": 1}],
                    }
                ]
            }
        )
        run(self.service.import_holdings("u1", second))
        [position] = self.supabase.db["portfolio_positions"]
        self.assertEqual(position["id"], nvda["id"])
        self.assertTrue(position["is_hidden"])
        self.assertEqual(position["units"], 20)
        self.assertEqual(
            [a["account_id"] for a in self.supabase.db["portfolio_accounts"]],
            [manual_account_key("Schwab")],
        )

    def test_clear_only_removes_manual_data(self):
        self.supabase.db["portfolio_connections"].append(
            {"id": "plaid", "user_id": "u1", "provider": "plaid", "is_connected": True}
        )
        run(self.service.import_holdings("u1", payload()))
        run(self.service.clear("u1"))
        self.assertEqual(
            [c["provider"] for c in self.supabase.db["portfolio_connections"]], ["plaid"]
        )
        self.assertEqual(self.supabase.db["portfolio_positions"], [])


class ConstraintError(Exception):
    code = "23514"


class MissingMigrationTests(unittest.TestCase):
    def test_check_violation_becomes_clear_error(self):
        supabase = FakeSupabase()
        original = supabase.table

        def table(name):
            query = original(name)
            if name == "portfolio_connections":
                insert = query.insert

                def failing_insert(data):
                    insert(data)
                    query.execute = lambda: (_ for _ in ()).throw(ConstraintError())
                    return query

                query.insert = failing_insert
            return query

        supabase.table = table
        service = ManualImportService(supabase, quote_fetcher=quote)
        with self.assertRaises(ManualImportUnavailable):
            run(service.import_holdings("u1", payload()))


class MergedHoldingsTests(unittest.TestCase):
    def test_holdings_merge_plaid_and_manual_and_share_together(self):
        supabase = FakeSupabase()
        db = supabase.db
        db["portfolio_connections"].append(
            {
                "id": "plaid",
                "user_id": "u1",
                "provider": "plaid",
                "is_connected": True,
                "is_public": True,
                "last_synced_at": "2026-11-01T00:00:00+00:00",
            }
        )
        db["portfolio_accounts"].append(
            {"id": "acc-p", "connection_id": "plaid", "account_id": "x"}
        )
        db["portfolio_positions"].append(
            {
                "id": "pos-p",
                "account_id": "acc-p",
                "symbol": "MSFT",
                "units": 1,
                "price": 100,
                "position_type": "equity",
                "is_hidden": False,
            }
        )
        run(ManualImportService(supabase, quote_fetcher=quote).import_holdings("u1", payload()))
        # The manual connection inherits the existing sharing choice.
        self.assertTrue(all(c["is_public"] for c in db["portfolio_connections"]))

        service = PortfolioService(supabase)
        holdings = run(service.get_user_holdings("u1"))
        self.assertEqual(sorted(a["source"] for a in holdings["accounts"]), ["manual", "plaid"])
        self.assertEqual(holdings["total_value"], 100 + 1500 + 1050 + 2400)

        status = run(service.get_connection_status("u1"))
        self.assertEqual(status["accounts_count"], 2)

        public = run(service.get_public_holdings("u1"))
        self.assertEqual(public["positions_count"], 4)

        run(service.toggle_public_sharing("u1", False))
        self.assertFalse(any(c["is_public"] for c in db["portfolio_connections"]))


if __name__ == "__main__":
    unittest.main()
