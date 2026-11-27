import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "kolvex-backend-py"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import digest  # noqa: E402

CAPTURED = "2026-11-21T03:30:00+00:00"  # 2026-11-20 19:30 PT, 11:30 Beijing
A, B, C, D = (f"{n:024x}" for n in (1, 2, 3, 4))


def post(note_id, title, raw="3小时前", keywords=("美股",), token=True):
    url = f"https://www.xiaohongshu.com/explore/{note_id}"
    return {
        "note_id": note_id,
        "url": url + ("?xsec_token=T&xsec_source=pc_search" if token else ""),
        "has_token": token,
        "title": title,
        "author_nickname": "博主",
        "published_raw": raw,
        "likes": 10,
        "keywords": list(keywords),
    }


def raw_run():
    return {
        "status": "complete",
        "captured_at": CAPTURED,
        "keywords": ["美股", "特斯拉"],
        "posts": [
            post(A, "纳指跌破年线，定投利润全吐了"),
            post(B, "美股还能抄底吗", raw="2天前"),
            post(C, "Model Y 提车一个月体验", keywords=("特斯拉",)),
            post(D, "英伟达财报前怎么看", raw="昨天 13:10", keywords=("美股", "特斯拉")),
        ],
        "deep_reads": [
            {
                "note_id": A,
                "body": "正文",
                "published_raw": "编辑于 2小时前 上海",
                "comments_total": 120,
                "comments": [
                    {"text": "利润全部吐完开始吃本金", "likes": 28},
                    {"text": "多买一点", "likes": None},
                ],
            }
        ],
        "warnings": ["sort_latest_unavailable"],
    }


LABELS = {
    "posts": [
        {"id": A, "related": True, "stance": "fear_panic"},
        {"id": B, "related": True, "stance": "mixed_cautious_buy"},
        {"id": C, "related": False, "stance": "neutral"},
        {"id": D, "related": True, "stance": "neutral"},
    ]
}
TOPICS = {
    "topics": [
        {
            "id": "dca-profit-wiped",
            "title": "定投利润回吐",
            "summary": "不少人说定投利润已经吐完。",
            "stance": "fear_panic",
            "tickers": ["qqq", "not a ticker"],
            "post_ids": [A, B, "made-up"],
            "source_ids": [A, "made-up"],
            "excerpt_ids": [f"{A}:0", "c99"],
        },
        {
            "id": "Bad ID",
            "title": "英伟达财报",
            "summary": "大家在等财报。",
            "stance": "neutral",
            "post_ids": [D],
            "source_ids": [D],
        },
        # Only an unrelated / invented source: no traceable topic, dropped.
        {"id": "cars", "title": "提车", "summary": "车。", "stance": "neutral", "source_ids": [C]},
    ],
    "rumors": [
        {"text": "英伟达断供", "status": "unverified", "tickers": ["NVDA"], "source_ids": []},
        {"text": "已证实", "status": "verified"},
    ],
    "limitations": ["特斯拉关键词下多为车型帖"],
}


def client_for(*responses):
    queue = list(responses)

    def handler(request):
        body = json.loads(request.content)
        assert body["model"] == "deepseek-flash"
        content = queue.pop(0)
        return httpx.Response(
            200,
            json={
                "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(content)}}]
            },
        )

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_counts_come_from_labels_and_invented_ids_are_dropped():
    day = digest.make_digest(raw_run(), "key", client_for(LABELS, TOPICS))
    assert day["date_pt"] == "2026-11-20"
    assert day["sample"]["posts_scanned"] == 3  # the car post is not about US stocks
    assert day["sample"]["posts_by_keyword"] == {"美股": 3, "特斯拉": 1}
    assert day["sentiment"]["all"] == {
        "fear_panic": 1,
        "bearish": 0,
        "neutral": 1,
        "mixed_cautious_buy": 1,
        "bullish": 0,
    }
    # A (2 hours) and D (yesterday 13:10 Beijing, 22 hours earlier) are inside 24 hours; B (2 days) is not.
    assert sum(day["sentiment"]["latest"].values()) == 2

    first, second = day["topics"]
    assert [first["id"], second["id"]] == ["dca-profit-wiped", "topic-2"]
    assert first["tickers"] == ["QQQ"]
    assert first["heat"] == {"posts": 2, "comments": None}  # B's comment total is unknown
    assert second["heat"] == {"posts": 1, "comments": None}
    assert [source["note_id"] for source in first["sources"]] == [A]
    assert first["excerpts"] == [{"text": "利润全部吐完开始吃本金", "likes": 28}]
    source = first["sources"][0]
    assert source["comments"] == 120
    assert source["published_raw"] == "编辑于 2小时前 上海"
    assert source["published_at"] == "2026-11-21T01:30:00+00:00"
    assert [rumor["status"] for rumor in day["rumors"]] == ["unverified"]
    assert day["limitations"][0].startswith("情绪分类与话题归纳由 AI")
    assert "部分关键词未能切换到「最新」排序" in day["limitations"][2]

    validated = digest.validate(day, date(2026, 11, 20))
    assert validated["topics"][0]["id"] == "dca-profit-wiped"


def test_missing_label_fails_instead_of_guessing():
    partial = {"posts": LABELS["posts"][:3]}
    with pytest.raises(digest.DigestError, match="incomplete_classification"):
        digest.make_digest(raw_run(), "key", client_for(partial))


def test_no_traceable_topic_fails():
    only_cars = {"topics": [TOPICS["topics"][2]]}
    with pytest.raises(digest.DigestError, match="no_traceable_topics"):
        digest.make_digest(raw_run(), "key", client_for(LABELS, only_cars))


def test_missing_key_and_http_errors_are_safe_codes():
    with pytest.raises(digest.DigestError, match="deepseek_key_missing"):
        digest.make_digest(raw_run(), None)
    failing = httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(401)))
    with pytest.raises(digest.DigestError, match="deepseek_http_401"):
        digest.make_digest(raw_run(), "key", failing)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("刚刚", "2026-11-21T03:30:00+00:00"),
        ("15分钟前", "2026-11-21T03:15:00+00:00"),
        ("3小时前 广东", "2026-11-21T00:30:00+00:00"),
        ("今天 08:00", "2026-11-21T00:00:00+00:00"),
        ("3天前", None),
        ("11-18", None),
        (None, None),
    ],
)
def test_parse_published(raw, expected):
    captured = datetime.fromisoformat(CAPTURED)
    value = digest.parse_published(raw, captured)
    assert (value.astimezone(timezone.utc).isoformat() if value else None) == expected
