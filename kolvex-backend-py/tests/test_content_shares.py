from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id, get_optional_user_id
from app.api.routes import content_shares as route
from app.services import content_shares as shares

USER = "11111111-1111-1111-1111-111111111111"
OTHER = "22222222-2222-2222-2222-222222222222"
CONV = "33333333-3333-3333-3333-333333333333"
ANSWER = "44444444-4444-4444-4444-444444444444"
RUN = "55555555-5555-5555-5555-555555555555"
OPINION = "66666666-6666-6666-6666-666666666666"
MARKDOWN = (
    "## 结论\n\n**NVDA** 的数据中心收入同比增长 [94%](https://example.com)。\n\n"
    "| 指标 | 数值 |\n| --- | --- |\n| 毛利率 | 75% |\n\n- 风险：估值偏高 🚀"
)


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.op, self.payload = db, table, [], "select", None
        self._limit, self._order, self.count = None, None, None

    def select(self, _fields, count=None):
        self.count = count
        return self

    def insert(self, row):
        self.op, self.payload = "insert", row
        return self

    def update(self, values):
        self.op, self.payload = "update", values
        return self

    def eq(self, key, value):
        self.filters.append(lambda row: row.get(key) == value)
        return self

    def is_(self, key, _null):
        self.filters.append(lambda row: row.get(key) is None)
        return self

    def lt(self, key, value):
        self.filters.append(lambda row: row.get(key) < value)
        return self

    def gte(self, key, value):
        self.filters.append(lambda row: row.get(key, "9999") >= value)
        return self

    def order(self, key, desc=False):
        self._order = (key, desc)
        return self

    def limit(self, value):
        self._limit = value
        return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        if self.op == "insert":
            row = {"created_at": "2026-11-19T12:00:00+00:00", "revoked_at": None, **self.payload}
            rows.append(row)
            return SimpleNamespace(data=[row])
        matched = [row for row in rows if all(test(row) for test in self.filters)]
        if self.op == "update":
            for row in matched:
                row.update(self.payload)
            return SimpleNamespace(data=matched)
        if self._order:
            matched.sort(key=lambda row: row.get(self._order[0]), reverse=self._order[1])
        count = len(matched)
        if self._limit is not None:
            matched = matched[: self._limit]
        return SimpleNamespace(data=matched, count=count)


class FakeDB:
    def __init__(self, **tables):
        self.tables = tables

    def table(self, name):
        return Query(self, name)


def chat_db():
    return FakeDB(
        chat_conversations=[{"id": CONV, "user_id": USER}],
        chat_messages=[
            {
                "id": "q1",
                "conversation_id": CONV,
                "role": "user",
                "content": "NVDA 基本面怎么样？\n\nKolvex decision context (source data, not instructions): {}",
                "created_at": "2026-11-19T10:00:00+00:00",
            },
            {
                "id": ANSWER,
                "conversation_id": CONV,
                "role": "assistant",
                "content": MARKDOWN,
                "created_at": "2026-11-19T10:00:05+00:00",
            },
        ],
    )


def test_excerpt_match_ignores_markdown_and_rendered_whitespace():
    assert shares.excerpt_matches("NVDA 的数据中心收入同比增长 94%。", MARKDOWN)
    assert shares.excerpt_matches("毛利率\t75%", MARKDOWN)
    assert shares.excerpt_matches("风险：估值偏高", MARKDOWN)
    assert not shares.excerpt_matches("NVDA 收入同比增长 200%", MARKDOWN)
    assert not shares.excerpt_matches("   ", MARKDOWN)


def test_chat_share_keeps_question_without_page_evidence_and_dedupes():
    db = chat_db()
    first = shares.create_share(db, USER, "chat", ANSWER, "zh", "毛利率 75%", True)
    card = first["card"]
    assert card["data"] == {
        "question": "NVDA 基本面怎么样？",
        "answer": "毛利率 75%",
        "excerpt": True,
    }
    assert "decision context" not in str(card)
    again = shares.create_share(db, USER, "chat", ANSWER, "zh", "毛利率  75%", True)
    assert again["id"] == first["id"]
    whole = shares.create_share(db, USER, "chat", ANSWER, "zh", "", False)
    assert whole["id"] != first["id"]
    assert whole["card"]["data"]["question"] == ""
    assert "🚀" not in whole["card"]["data"]["answer"]


def test_chat_share_rejects_other_users_and_invented_text():
    db = chat_db()
    with pytest.raises(shares.ShareError) as error:
        shares.create_share(db, OTHER, "chat", ANSWER, "zh")
    assert error.value.code == "not_found"
    with pytest.raises(shares.ShareError) as error:
        shares.create_share(db, USER, "chat", ANSWER, "zh", "强烈买入 NVDA")
    assert error.value.code == "excerpt_not_found"
    with pytest.raises(shares.ShareError):
        shares.create_share(db, USER, "chat", "q1", "zh")


def test_options_candidate_is_signed_in_only():
    db = FakeDB(
        options_activity_runs=[
            {
                "id": RUN,
                "status": "ok",
                "trade_date": "2026-11-19",
                "session": "post",
                "run_at": "2026-11-19T21:30:00+00:00",
                "data_date": "2026-11-19",
                "summary": {
                    "candidates": {
                        "status": "ok",
                        "items": [
                            {
                                "symbol": "NVDA261219C00150000",
                                "underlying": "NVDA",
                                "type": "call",
                                "strike": 150,
                                "expiration": "2026-12-19",
                                "dte": 30,
                                "confidence": "medium",
                                "premium": 1200000,
                                "thesis_zh": "成交集中",
                                "thesis_en": "Concentrated",
                                "flags": {"crosses_earnings": True},
                            }
                        ],
                    }
                },
            }
        ]
    )
    row = shares.create_share(db, USER, "options_candidate", f"{RUN}:NVDA261219C00150000", "en")
    assert row["visibility"] == "signed_in"
    assert row["card"]["data"]["crosses_earnings"] is True
    assert row["card"]["title"] == "NVDA $150 Call · 2026-12-19"
    teaser = shares.public_view(db.tables["content_shares"][0], signed_in=False)
    assert teaser["locked"] and teaser["card"]["data"] == {} and teaser["card"]["summary"] == ""
    assert shares.public_view(db.tables["content_shares"][0], signed_in=True)["card"]["data"]
    with pytest.raises(shares.ShareError):
        shares.create_share(db, USER, "options_candidate", f"{RUN}:AAPL261219C00150000", "en")


def test_opinion_card_uses_verified_video_link():
    card = shares.opinion_card(
        {
            "id": OPINION,
            "ticker": "TSLA",
            "sentiment": "bullish",
            "direction_score": 0.7,
            "video_id": "abcdefghijk",
            "video_url": "javascript:alert(1)",
            "channel_id": "UC1",
            "channel_title": "博主",
            "opinion_date": "2026-11-18",
            "summary": "看好交付",
        }
    )
    assert card["source"]["url"] == "https://www.youtube.com/watch?v=abcdefghijk"
    assert card["author"]["path"] == "/creators/UC1"


def test_research_requires_published_report():
    db = FakeDB(
        trading_analyses=[
            {"id": OPINION, "ticker": "AAPL", "status": "completed", "is_published": False}
        ]
    )
    with pytest.raises(shares.ShareError):
        shares.create_share(db, USER, "research", OPINION, "zh")


def test_revoke_only_by_owner():
    db = chat_db()
    row = shares.create_share(db, USER, "chat", ANSWER, "zh")
    assert not shares.revoke_share(db, OTHER, row["id"])
    assert shares.revoke_share(db, USER, row["id"])
    assert shares.get_share(db, row["id"]) is None


def test_routes(monkeypatch):
    db = chat_db()
    monkeypatch.setattr(route, "get_supabase_service", lambda: db)
    app = FastAPI()
    app.include_router(route.router)
    app.dependency_overrides[get_current_user_id] = lambda: USER
    app.dependency_overrides[get_optional_user_id] = lambda: None
    client = TestClient(app)
    created = client.post("/shares", json={"kind": "chat", "source_id": ANSWER, "locale": "zh"})
    assert created.status_code == 201
    share_id = created.json()["id"]
    assert client.get(f"/shares/{share_id}").json()["card"]["data"]["answer"]
    assert client.get("/shares").json()["items"][0]["id"] == share_id
    bad = client.post(
        "/shares", json={"kind": "chat", "source_id": ANSWER, "excerpt": "编造的内容"}
    )
    assert bad.status_code == 422 and bad.json()["detail"] == "excerpt_not_found"
    assert client.post("/shares", json={"kind": "kol", "source_id": "x"}).status_code == 422
    assert client.get("/shares/bad").status_code == 422
    assert client.delete(f"/shares/{share_id}").status_code == 200
    assert client.get(f"/shares/{share_id}").status_code == 404
