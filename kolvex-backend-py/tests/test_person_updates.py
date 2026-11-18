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
