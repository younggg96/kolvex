import copy
import json
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import verify_admin
from app.api.routes import xhs_sentiment as routes
from app.core.supabase import get_supabase_service
from app.schemas.xhs_sentiment import validate_digest

TODAY = date(2026, 11, 20)
NOTE = "6740a1b2000000001e01c2d3"
SOURCE = {
    "note_id": NOTE,
    "url": f"https://www.xiaohongshu.com/explore/{NOTE}?xsec_token=abc",
    "title": "美股纳指，已跌破今年来所有盈利，科技熊市？",
    "author_nickname": "纳斯达克的春秋",
    "published_at": "2026-11-20T09:50:00-08:00",
    "published_raw": "10小时前",
    "comments": 283,
}
COUNTS = {"fear_panic": 21, "bearish": 94, "neutral": 48, "mixed_cautious_buy": 14, "bullish": 9}


def topic(topic_id="dca-profit-wiped", posts=12, comments=283):
    return {
        "id": topic_id,
        "title": "定投利润回吐",
        "summary": "不少人表示定投利润已经吐完。",
        "stance": "fear_panic",
        "tickers": ["QQQ"],
        "heat": {"posts": posts, "comments": comments},
        "excerpts": [{"text": "同样的钱可以多买一点了", "likes": 43}],
        "sources": [SOURCE],
    }


DIGEST = {
    "schema_version": "xhs-daily.v2",
    "date_pt": "2026-11-20",
    "captured_at": "2026-11-20T19:50:00-08:00",
    "sample": {
        "keywords": ["美股", "英伟达"],
        "posts_scanned": 186,
        "posts_by_keyword": {"美股": 83},
        "classified_by": "title",
        "latest_window_hours": 24,
    },
    "sentiment": {
        "all": COUNTS,
        "latest": {
            "fear_panic": 19,
            "bearish": 65,
            "neutral": 10,
            "mixed_cautious_buy": 9,
            "bullish": 3,
        },
    },
    "topics": [topic()],
    "rumors": [{"text": "某传言", "status": "unverified", "tickers": ["NVDA"]}],
    "limitations": ["评论为热评抽样"],
}


def validate(document, chinese=True, today=TODAY):
    return validate_digest(json.dumps(document).encode(), today, chinese)


def changed(path, value):
    document = copy.deepcopy(DIGEST)
    target = document
    for key in path[:-1]:
        target = target[key]
    if value is DELETE:
        del target[path[-1]]
    else:
        target[path[-1]] = value
    return document


DELETE = object()


def test_valid_digest_normalizes_time_and_sorts_topics_by_heat():
    document = copy.deepcopy(DIGEST)
    document["topics"] = [topic("quiet", 3, None), topic("loud", 12, 5), topic("tie", 12, 9)]
    digest, errors = validate(document)
    assert errors == []
    assert digest["captured_at"] == "2026-11-21T03:50:00+00:00"
    assert [item["id"] for item in digest["topics"]] == ["tie", "loud", "quiet"]
    assert digest["rumors"][0]["sources"] == []


@pytest.mark.parametrize(
    ("path", "value", "message"),
    [
        (("sample", "posts_scanned"), 185, "sample.posts_scanned 须等于"),
        (("sample", "latest_window_hours"), DELETE, "latest_window_hours"),
        (("sentiment", "score"), -57, "未知字段"),
        (("topics",), [], "数量不足"),
        (("topics",), [topic(), topic()], "话题 id 不能重复"),
        (("topics", 0, "sources"), [], "topics[1].sources：数量不足"),
        (("topics", 0, "stance"), "panic", "topics[1].stance：取值不在允许范围内"),
        (("topics", 0, "tickers"), ["nvda"], "topics[1].tickers[1]：格式不正确"),
        (("date_pt",), "2026-11-21", "不能晚于太平洋时间今天"),
        (("captured_at",), "2026-11-20 19:50", "带时区"),
        (("schema_version",), "xhs.v1", "schema_version"),
    ],
)
def test_rejects_invalid_digest(path, value, message):
    digest, errors = validate(changed(path, value))
    assert digest is None
    assert any(message in error for error in errors), errors


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"url": "http://www.xiaohongshu.com/explore/" + NOTE}, "HTTPS"),
        ({"url": "https://example.com/explore/" + NOTE}, "HTTPS"),
        ({"url": "https://www.xiaohongshu.com/explore/other"}, "note_id"),
        ({"likes": 3}, "未知字段"),
    ],
)
def test_rejects_untraceable_sources(change, message):
    document = copy.deepcopy(DIGEST)
    document["topics"][0]["sources"] = [{**SOURCE, **change}]
    digest, errors = validate(document)
    assert digest is None
    assert any(message in error for error in errors), errors


def test_short_links_skip_the_path_check_and_excerpts_reject_commenter_identity():
    document = copy.deepcopy(DIGEST)
    document["topics"][0]["sources"] = [{**SOURCE, "url": "https://xhslink.com/a/AbC123"}]
    assert validate(document)[1] == []
    document["topics"][0]["excerpts"] = [{"text": "原话", "likes": 1, "author": "东哥"}]
    assert any("excerpts[1].author：未知字段" in error for error in validate(document)[1])


def test_english_and_syntax_errors():
    assert validate(changed(("topics",), []), chinese=False)[1][0].startswith("topics:")
    digest, errors = validate_digest(b"{", TODAY, True)
    assert digest is None and errors[0].startswith("JSON 格式错误（第 1 行")


@pytest.fixture
def client():
    db = Mock()
    app = FastAPI()
    app.include_router(routes.router)
    admin = FastAPI()
    admin.include_router(routes.admin_router)
    app.mount("/admin", admin)
    for target in (app, admin):
        target.dependency_overrides[verify_admin] = lambda: "admin-id"
        target.dependency_overrides[get_supabase_service] = lambda: db
    return TestClient(app), db


def test_validate_reports_replacement_without_writing(client, monkeypatch):
    http, db = client
    monkeypatch.setattr(routes, "validate_digest", lambda body, today, chinese: (DIGEST, []))
    table = db.table.return_value
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        SimpleNamespace(data=[{"date_pt": "2026-11-20"}])
    )
    response = http.post("/admin/xhs-sentiment/validate", content=b"{}")
    assert response.status_code == 200
    assert response.json()["replaces_existing"] is True
    table.upsert.assert_not_called()


def test_save_upserts_one_day_with_audit_fields(client):
    http, db = client
    response = http.post("/admin/xhs-sentiment", content=json.dumps(DIGEST).encode())
    assert response.status_code == 200, response.text
    assert response.json() == {"date_pt": "2026-11-20", "topics": 1}
    record = db.table.return_value.upsert.call_args.args[0]
    assert record["imported_by"] == "admin-id"
    assert set(record) == {
        "date_pt",
        "captured_at",
        "sample",
        "sentiment",
        "topics",
        "rumors",
        "limitations",
        "imported_by",
        "imported_at",
    }
    assert db.table.return_value.upsert.call_args.kwargs["on_conflict"] == "date_pt"


def test_invalid_upload_is_rejected_before_any_write(client):
    http, db = client
    response = http.post("/admin/xhs-sentiment", content=b"{}")
    assert response.status_code == 422
    db.table.return_value.upsert.assert_not_called()


def test_public_reads(client):
    http, db = client
    row = {
        "date_pt": "2026-11-20",
        "captured_at": "2026-11-21T03:50:00+00:00",
        "sample": DIGEST["sample"],
        "sentiment": DIGEST["sentiment"],
    }
    listing = db.table.return_value.select.return_value.order.return_value.limit.return_value
    listing.execute.return_value = SimpleNamespace(data=[row])
    days = http.get("/xhs-sentiment/days?limit=7").json()["days"]
    assert days == [
        {
            "date_pt": "2026-11-20",
            "captured_at": "2026-11-21T03:50:00+00:00",
            "posts_scanned": 186,
            "classified_by": "title",
            "latest_window_hours": 24,
            "sentiment": DIGEST["sentiment"],
        }
    ]
    detail = db.table.return_value.select.return_value.eq.return_value.limit.return_value
    detail.execute.return_value = SimpleNamespace(data=[])
    assert http.get("/xhs-sentiment/days/2026-11-19").status_code == 404
    assert http.get("/xhs-sentiment/days/2026-02-30").status_code == 422
    assert http.get("/xhs-sentiment/days/latest").status_code == 422
    assert http.get("/xhs-sentiment/days?limit=500").status_code == 422
