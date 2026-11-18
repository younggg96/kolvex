import asyncio
import unittest

from app.services.plaid import _without_removed
from app.services.portfolio.account_removal import (
    AccountNotFound,
    AccountRemovalService,
    AccountRemovalUnavailable,
)
from tests.test_portfolio_manual_import import FakeSupabase


def seeded(with_column=True):
    supabase = FakeSupabase()
    supabase.db["plaid_investment_transactions"] = [
        {"id": "tx1", "user_id": "u1", "account_id": "plaid-card"},
        {"id": "tx2", "user_id": "u1", "account_id": "plaid-brokerage"},
    ]
    plaid = {
        "id": "c-plaid",
        "user_id": "u1",
        "provider": "plaid",
        "privacy_settings": {"hidden_accounts": ["a-card", "a-brokerage"]},
    }
    if with_column:
        plaid["removed_account_ids"] = []
    supabase.db["portfolio_connections"] = [
        plaid,
        {"id": "c-manual", "user_id": "u1", "provider": "manual", "removed_account_ids": []},
        {"id": "c-other", "user_id": "u2", "provider": "plaid", "removed_account_ids": []},
    ]
    supabase.db["portfolio_accounts"] = [
        {"id": "a-card", "connection_id": "c-plaid", "account_id": "plaid-card"},
        {"id": "a-brokerage", "connection_id": "c-plaid", "account_id": "plaid-brokerage"},
        {"id": "a-manual", "connection_id": "c-manual", "account_id": "manual:rh"},
        {"id": "a-other", "connection_id": "c-other", "account_id": "plaid-x"},
    ]
    supabase.db["portfolio_positions"] = [
        {"id": "p1", "account_id": "a-card"},
        {"id": "p2", "account_id": "a-brokerage"},
        {"id": "p3", "account_id": "a-manual"},
    ]
    return supabase


def remove(supabase, user_id, account_id):
    return asyncio.run(AccountRemovalService(supabase).remove_account(user_id, account_id))


class AccountRemovalTests(unittest.TestCase):
    def test_plaid_account_is_deleted_and_remembered(self):
        supabase = seeded()
        assert remove(supabase, "u1", "a-card") == {"success": True, "account_id": "a-card"}

        db = supabase.db
        assert [a["id"] for a in db["portfolio_accounts"]] == ["a-brokerage", "a-manual", "a-other"]
        assert [p["id"] for p in db["portfolio_positions"]] == ["p2", "p3"]
        assert [t["id"] for t in db["plaid_investment_transactions"]] == ["tx2"]
        plaid = db["portfolio_connections"][0]
        assert plaid["removed_account_ids"] == ["plaid-card"]
        assert plaid["privacy_settings"]["hidden_accounts"] == ["a-brokerage"]

    def test_manual_account_is_deleted_without_exclusion(self):
        supabase = seeded()
        remove(supabase, "u1", "a-manual")
        assert "a-manual" not in [a["id"] for a in supabase.db["portfolio_accounts"]]
        assert supabase.db["portfolio_connections"][1]["removed_account_ids"] == []

    def test_cannot_remove_another_users_account(self):
        supabase = seeded()
        with self.assertRaises(AccountNotFound):
            remove(supabase, "u1", "a-other")
        with self.assertRaises(AccountNotFound):
            remove(supabase, "nobody", "a-card")
        assert len(supabase.db["portfolio_accounts"]) == 4

    def test_plaid_removal_needs_migration(self):
        supabase = seeded(with_column=False)
        with self.assertRaises(AccountRemovalUnavailable):
            remove(supabase, "u1", "a-card")
        assert len(supabase.db["portfolio_accounts"]) == 4

    def test_sync_payload_drops_removed_accounts(self):
        payload = {
            "accounts": [{"account_id": "keep"}, {"account_id": "gone"}],
            "holdings": [{"account_id": "keep"}, {"account_id": "gone"}],
            "investment_transactions": [{"account_id": "gone"}],
            "securities": [{"security_id": "s"}],
        }
        filtered = _without_removed(payload, {"gone"})
        assert filtered["accounts"] == [{"account_id": "keep"}]
        assert filtered["holdings"] == [{"account_id": "keep"}]
        assert filtered["investment_transactions"] == []
        assert filtered["securities"] == payload["securities"]
        assert _without_removed(payload, set()) is payload


if __name__ == "__main__":
    unittest.main()
