"""Trade OS routes that take an account or trade-group id must check the caller owns it."""

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.api.routes.trade_os import analytics, journal, market, ownership, scanner

OWNER, OTHER = "user-owner", "user-other"
ACCOUNTS = {"acct-1": OWNER}
TRADE_GROUPS = {"tg-1": "acct-1"}


class FakeQuery:
    def __init__(self, table):
        self.table, self.filters = table, {}

    def select(self, *_):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def limit(self, *_):
        return self

    def execute(self):
        class Result:
            pass

        result = Result()
        if self.table == "trading_accounts":
            owner = ACCOUNTS.get(self.filters.get("id"))
            ok = owner is not None and owner == self.filters.get("user_id")
            result.data = [{"id": self.filters["id"], "user_id": owner}] if ok else []
        else:
            account = TRADE_GROUPS.get(self.filters.get("id"))
            result.data = [{"account_id": account}] if account else []
        return result


class FakeAccountService:
    def __init__(self):
        self.supabase = self

    def table(self, name):
        return FakeQuery(name)

    def get_account(self, user_id, account_id):
        rows = FakeQuery("trading_accounts").eq("id", account_id).eq("user_id", user_id).execute()
        return rows.data[0] if rows.data else None


def _client(monkeypatch, user):
    monkeypatch.setattr(ownership, "AccountService", FakeAccountService)
    calls = []

    async def fake_entries(account_id):
        calls.append(("journal", account_id))
        return []

    async def fake_save(**kwargs):
        calls.append(("review", kwargs["trade_group_id"], kwargs["user_id"]))
        return {"ok": True}

    async def fake_analytics(account_id):
        calls.append(("analytics", account_id))
        return {}

    monkeypatch.setattr(journal, "get_journal_entries", fake_entries)
    monkeypatch.setattr(journal, "save_journal_review", fake_save)
    monkeypatch.setattr(analytics, "get_account_performance_analytics", fake_analytics)

    app = FastAPI()
    for module in (journal, analytics, market, scanner):
        app.include_router(module.router)

    def identity():
        if user is None:
            raise HTTPException(status_code=401, detail="unauthorized")
        return user

    app.dependency_overrides[get_current_user_id] = identity
    return TestClient(app), calls


def test_owner_can_read_and_review(monkeypatch):
    client, calls = _client(monkeypatch, OWNER)
    assert client.get("/journal/acct-1").status_code == 200
    assert client.get("/analytics/acct-1").status_code == 200
    assert client.post("/journal/review", json={"trade_group_id": "tg-1"}).status_code == 200
    assert calls == [("journal", "acct-1"), ("analytics", "acct-1"), ("review", "tg-1", OWNER)]


def test_other_user_gets_404_and_nothing_runs(monkeypatch):
    client, calls = _client(monkeypatch, OTHER)
    assert client.get("/journal/acct-1").status_code == 404
    assert client.get("/analytics/acct-1").status_code == 404
    assert client.post("/journal/review", json={"trade_group_id": "tg-1"}).status_code == 404
    assert client.post("/journal/review", json={"trade_group_id": "missing"}).status_code == 404
    assert calls == []


def test_anonymous_requests_are_rejected(monkeypatch):
    client, calls = _client(monkeypatch, None)
    assert client.get("/journal/acct-1").status_code == 401
    assert client.get("/analytics/acct-1").status_code == 401
    assert client.post("/journal/review", json={"trade_group_id": "tg-1"}).status_code == 401
    assert client.post("/market/evaluate").status_code == 401
    assert client.post("/scanner/run", json={}).status_code == 401
    assert calls == []
