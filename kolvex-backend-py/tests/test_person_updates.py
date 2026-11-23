import json

import pytest

from app.schemas.person_updates import validate_import

ENTRY = {
    "id": "trump-2026-11-18-ph-trade",
    "person": "Donald Trump",
    "person_cn": "特朗普",
    "published_at": "2026-11-18T02:44:00-05:00",
    "title": "标题",
    "summary": "摘要",
    "source_url": "https://www.reuters.com/xxx",
    "impact": "high",
}


def validate(*items, chinese=True):
    return validate_import(json.dumps({"items": items}).encode(), chinese)


def test_plain_and_illustrated_items():
    plain, errors = validate(ENTRY)
    assert not errors
    assert plain[0] == {
        **ENTRY,
        "published_at": "2026-11-18T07:44:00+00:00",
        "tags": [],
        "tickers": [],
        "avatar_url": None,
        "image_url": None,
        "image_alt": None,
    }
    illustrated, errors = validate(
        {
            **ENTRY,
            "avatar_url": "https://example.com/avatar.png",
            "image_url": "https://example.com/image.png",
            "image_alt": "配图说明",
        }
    )
    assert not errors
    assert illustrated[0]["avatar_url"] == "https://example.com/avatar.png"
    assert illustrated[0]["image_url"] == "https://example.com/image.png"
    assert illustrated[0]["image_alt"] == "配图说明"


def test_batch_reports_missing_fields_and_duplicate_ids():
    second = dict(ENTRY)
    del second["source_url"]
    second["impact"] = "urgent"
    items, errors = validate(ENTRY, second)
    assert not items
    assert errors == [
        "第 2 条缺少 source_url",
        "第 2 条 impact：须为 high、medium 或 low",
        "第 2 条的 id 与第 1 条重复",
    ]


def test_json_syntax_reports_position():
    _, errors = validate_import(b'{\n"items": [ }', chinese=True)
    assert "第 2 行，第 12 列" in errors[0]


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"id": "Bad--id"}, "id"),
        ({"title": " "}, "title"),
        ({"summary": "\x00"}, "summary"),
        ({"published_at": "2026-11-18T02:44:00"}, "published_at"),
        ({"published_at": "2026-02-30T02:44:00Z"}, "published_at"),
        ({"published_at": "2026-11-18T02:44:00-05:60"}, "published_at"),
        ({"published_at": "0001-01-01T00:00:00+01:00"}, "published_at"),
        ({"source_url": "javascript:alert(1)"}, "source_url"),
        ({"source_url": "https:///example.com"}, "source_url"),
        ({"image_url": "https://example.com/image.png"}, "image_alt"),
        ({"image_alt": "Photo"}, "image_alt"),
        ({"avatar_url": "http://example.com/avatar.png"}, "avatar_url"),
        ({"avatar_url": "data:image/png;base64,AAAA"}, "avatar_url"),
        ({"image_url": "https://example.com:99999/a", "image_alt": "Photo"}, "image_url"),
        ({"tags": ["tag", 1]}, "tags.1"),
    ],
)
def test_invalid_fields(changes, field):
    items, errors = validate({**ENTRY, **changes}, chinese=False)
    assert not items
    assert field in errors[0]


class _Query:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return self

    def delete(self):
        self.calls.append(("delete",))
        return self

    def upsert(self, row, on_conflict):
        self.calls.append(("upsert", row, on_conflict))
        return self

    def select(self, columns):
        self.calls.append(("select", columns))
        return self

    def eq(self, column, value):
        self.calls.append(("eq", column, value))
        return self

    def execute(self):
        return type("Response", (), {"data": self.rows})()


def _admin_client(db):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.dependencies.auth import verify_admin
    from app.api.routes.person_updates import admin_router
    from app.core.supabase import get_supabase_service

    app = FastAPI()
    app.include_router(admin_router)
    app.dependency_overrides[verify_admin] = lambda: "admin"
    app.dependency_overrides[get_supabase_service] = lambda: db
    return TestClient(app)


def test_admin_delete_removes_one_update():
    db = _Query([{"id": ENTRY["id"]}])
    response = _admin_client(db).delete(f"/person-updates/{ENTRY['id']}")
    assert response.status_code == 200
    assert response.json() == {"id": ENTRY["id"]}
    assert ("eq", "id", ENTRY["id"]) in db.calls


def test_admin_delete_reports_missing_and_rejects_bad_ids():
    client = _admin_client(_Query([]))
    missing = client.delete("/person-updates/gone", headers={"Accept-Language": "zh"})
    assert missing.status_code == 404
    assert missing.json()["detail"] == "这条动态不存在或已删除。"
    assert client.delete("/person-updates/Bad_ID").status_code == 422


PORTRAIT = "https://upload.wikimedia.org/wikipedia/commons/a/a0/Trump.jpg"


def test_admin_sets_and_clears_a_portrait_by_person_key():
    db = _Query([])
    client = _admin_client(db)
    saved = client.put(
        "/person-updates/avatars", json={"person": " Donald  J. Trump", "avatar_url": PORTRAIT}
    )
    assert saved.status_code == 200
    assert saved.json() == {"person_key": "donald trump", "avatar_url": PORTRAIT}
    upsert = next(call for call in db.calls if call[0] == "upsert")
    assert upsert[1]["person_key"] == "donald trump"
    assert upsert[1]["avatar_url"] == PORTRAIT
    assert upsert[2] == "person_key"

    db.calls.clear()
    cleared = client.put(
        "/person-updates/avatars", json={"person": "Donald Trump", "avatar_url": None}
    )
    assert cleared.status_code == 200
    assert ("delete",) in db.calls
    assert ("eq", "person_key", "donald trump") in db.calls


def test_admin_portrait_rejects_non_https():
    client = _admin_client(_Query([]))
    response = client.put(
        "/person-updates/avatars",
        json={"person": "Donald Trump", "avatar_url": "http://example.com/a.jpg"},
        headers={"Accept-Language": "zh"},
    )
    assert response.status_code == 422
    assert "HTTPS" in response.json()["detail"]


class _Timeline:
    """Returns the updates for person_updates and the portraits for person_avatars."""

    def __init__(self, updates, portraits):
        self.tables = {"person_updates": updates, "person_avatars": portraits}

    def table(self, name):
        rows = self.tables[name]
        query = _Query([] if isinstance(rows, Exception) else rows)
        if isinstance(rows, Exception):

            def fail():
                raise rows

            query.execute = fail
        for method in ("order", "range"):
            setattr(query, method, lambda *args, **kwargs: query)
        return query


def test_timeline_prefers_admin_portrait_and_survives_missing_table():
    from postgrest.exceptions import APIError

    from app.api.routes.person_updates import timeline

    rows = [{**ENTRY, "avatar_url": None}, {**ENTRY, "id": "other", "person": "Jensen Huang"}]
    result = timeline(
        _Timeline(
            [dict(row) for row in rows], [{"person_key": "donald trump", "avatar_url": PORTRAIT}]
        )
    )
    assert [item["profile_avatar_url"] for item in result["items"]] == [PORTRAIT, None]

    missing = APIError({"message": "relation does not exist", "code": "42P01"})
    result = timeline(_Timeline([dict(row) for row in rows], missing))
    assert [item["profile_avatar_url"] for item in result["items"]] == [None, None]
