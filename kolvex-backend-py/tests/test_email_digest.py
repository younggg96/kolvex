import pytest

from app.services import email_digest


def test_merge_keeps_default_order_and_drops_unknown_sections():
    merged = email_digest.merge_content(
        "daily_brief",
        {
            "sections": [
                {"id": "research", "enabled": False, "title": "研究"},
                {"id": "bogus", "enabled": True},
            ]
        },
    )
    assert [s["id"] for s in merged["sections"]] == ["brief", "kol", "options", "research"]
    research = merged["sections"][3]
    assert research == {"id": "research", "enabled": False, "title": "研究", "note": ""}


def test_validate_rejects_non_https_hero():
    with pytest.raises(ValueError):
        email_digest.validate_content("daily_brief", {"hero_image_url": "http://example.com/a.png"})


def test_page_escapes_admin_text():
    content = email_digest.merge_content("daily_brief", {"intro": "<script>x</script>"})
    html = email_digest.page(content, __import__("datetime").date(2026, 11, 13), [])
    assert "<script>" not in html and "&lt;script&gt;" in html


def test_research_summary_skips_headings():
    payload = {
        "full_signal": "# Verdict\n\n## Decision: SELL\n\nAfter weighing all three analysts across two full rounds, I side with caution."
    }
    assert email_digest.research_summary(payload).startswith("After weighing")


def test_kol_creators_are_deduped_and_trimmed():
    merged = email_digest.merge_content(
        "daily_brief", {"sections": [{"id": "kol", "creators": ["UC1", " UC2 ", "UC1", ""]}]}
    )
    assert merged["sections"][1]["creators"] == ["UC1", "UC2"]


def test_delivery_defaults_and_custom_validation():
    merged = email_digest.merge_content("daily_brief", {})
    assert merged["delivery"] == {"mode": "approval", "audience": "subscribers", "emails": []}
    with pytest.raises(ValueError):
        email_digest.validate_content(
            "daily_brief", {"delivery": {"audience": "custom", "emails": []}}
        )
    with pytest.raises(ValueError):
        email_digest.validate_content(
            "daily_brief", {"delivery": {"audience": "custom", "emails": ["not-an-email"]}}
        )
    ok = email_digest.validate_content(
        "daily_brief",
        {"delivery": {"mode": "auto", "audience": "custom", "emails": ["A@x.com", "a@x.com"]}},
    )
    assert ok["delivery"] == {"mode": "auto", "audience": "custom", "emails": ["a@x.com"]}


def test_brief_id_is_kept_only_when_valid():
    good = "0f8fad5b-d9cb-469f-a165-70867728950e"
    merged = email_digest.merge_content(
        "daily_brief", {"sections": [{"id": "brief", "brief_id": f" {good} "}]}
    )
    assert merged["sections"][0]["brief_id"] == good
    merged = email_digest.merge_content(
        "daily_brief", {"sections": [{"id": "brief", "brief_id": "x'); drop"}]}
    )
    assert merged["sections"][0]["brief_id"] == ""


def test_unpin_brief_after_send():
    from app.services.email_service import unpin_brief

    content = email_digest.merge_content("daily_brief", {})
    assert unpin_brief(content) is None
    content["sections"][0]["brief_id"] = "0f8fad5b-d9cb-469f-a165-70867728950e"
    cleared = unpin_brief(content)
    assert (
        cleared["sections"][0]["brief_id"] == ""
        and cleared["sections"][1] == content["sections"][1]
    )


def test_video_date_uses_eastern_time():
    # 2026-11-13 01:30 UTC is the evening of 11-12 in New York.
    assert email_digest.video_date("2026-11-13T01:30:00+00:00") == "2026-11-12"
    assert email_digest.video_date("2026-11-13T01:30:00Z") == "2026-11-12"
    assert email_digest.video_date("2026-11-13T15:00:00+00:00") == "2026-11-13"
    assert email_digest.video_date(None) == ""
