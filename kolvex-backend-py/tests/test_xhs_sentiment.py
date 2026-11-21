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
from app.schemas.xhs_sentiment import validate_batch, validate_digest

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
        ({"url": "https://www.xiaohongshu.com/discovery/item/" + NOTE}, "xsec_token"),
        ({"url": f"https://www.xiaohongshu.com/explore/{NOTE}?xsec_token="}, "xsec_token"),
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


def day(date_pt):
    return {**copy.deepcopy(DIGEST), "date_pt": date_pt}


def test_validate_reports_which_days_replace_saved_ones_without_writing(client):
    http, db = client
    table = db.table.return_value
    table.select.return_value.in_.return_value.execute.return_value = SimpleNamespace(
        data=[{"date_pt": "2026-11-19"}]
    )
    body = json.dumps([day("2026-11-18"), day("2026-11-20"), day("2026-11-19")]).encode()
    response = http.post("/admin/xhs-sentiment/validate", content=body)
    assert response.status_code == 200, response.text
    days = response.json()["days"]
    assert [(item["digest"]["date_pt"], item["replaces_existing"]) for item in days] == [
        ("2026-11-20", False),
        ("2026-11-19", True),
        ("2026-11-18", False),
    ]
    assert table.select.return_value.in_.call_args.args == (
        "date_pt",
        ["2026-11-20", "2026-11-19", "2026-11-18"],
    )
    table.upsert.assert_not_called()


def test_save_upserts_one_day_with_audit_fields(client):
    http, db = client
    response = http.post("/admin/xhs-sentiment", content=json.dumps(DIGEST).encode())
    assert response.status_code == 200, response.text
    assert response.json() == {"dates": ["2026-11-20"], "topics": 1}
    records = db.table.return_value.upsert.call_args.args[0]
    assert len(records) == 1
    assert records[0]["imported_by"] == "admin-id"
    assert set(records[0]) == {
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


def test_save_writes_every_day_in_one_upsert(client):
    http, db = client
    body = json.dumps([day("2026-11-19"), day("2026-11-20")]).encode()
    response = http.post("/admin/xhs-sentiment", content=body)
    assert response.status_code == 200, response.text
    assert response.json() == {"dates": ["2026-11-20", "2026-11-19"], "topics": 2}
    db.table.return_value.upsert.assert_called_once()
    records = db.table.return_value.upsert.call_args.args[0]
    assert [record["date_pt"] for record in records] == ["2026-11-20", "2026-11-19"]
    assert records[0]["imported_at"] == records[1]["imported_at"]


def test_one_bad_day_blocks_the_whole_batch(client):
    http, db = client
    bad = day("2026-11-19")
    bad["topics"] = []
    response = http.post(
        "/admin/xhs-sentiment", content=json.dumps([day("2026-11-20"), bad]).encode()
    )
    assert response.status_code == 422
    assert "第 2 天（2026-11-19） topics：数量不足" in response.json()["detail"]
    db.table.return_value.upsert.assert_not_called()


@pytest.mark.parametrize(
    ("document", "message"),
    [
        ([], "顶层须为一天的对象，或包含 1–31 天的数组"),
        ([day("2026-10-01")] * 32, "顶层须为一天的对象，或包含 1–31 天的数组"),
        ("2026-11-20", "顶层须为一天的对象"),
        ([day("2026-11-20"), day("2026-11-20")], "第 2 天（2026-11-20） 与第 1 天日期重复"),
        ([day("2026-11-20"), 5], "第 2 天 JSON：须为对象"),
    ],
)
def test_batch_shape_errors(document, message):
    days, errors = validate_batch(json.dumps(document).encode(), TODAY, True)
    assert days is None
    assert any(message in error for error in errors), errors


def test_batch_returns_days_newest_first_and_english_labels():
    days, errors = validate_batch(
        json.dumps([day("2026-11-01"), day("2026-11-20")]).encode(), TODAY, True
    )
    assert errors == [] and [item["date_pt"] for item in days] == ["2026-11-20", "2026-11-01"]
    bad = day("2026-11-19")
    bad["topics"] = []
    _, errors = validate_batch(json.dumps([bad]).encode(), TODAY, False)
    assert errors[0].startswith("Day 1 (2026-11-19) topics:")


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
