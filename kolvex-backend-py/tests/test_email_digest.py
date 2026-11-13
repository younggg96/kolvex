import pytest

from app.services import email_digest


def test_merge_keeps_default_order_and_drops_unknown_sections():
    merged = email_digest.merge_content("daily_brief", {"sections": [
        {"id": "research", "enabled": False, "title": "研究"},
        {"id": "bogus", "enabled": True},
    ]})
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
    payload = {"full_signal": "# Verdict\n\n## Decision: SELL\n\nAfter weighing all three analysts across two full rounds, I side with caution."}
    assert email_digest.research_summary(payload).startswith("After weighing")


def test_kol_creators_are_deduped_and_trimmed():
    merged = email_digest.merge_content("daily_brief", {"sections": [{"id": "kol", "creators": ["UC1", " UC2 ", "UC1", ""]}]})
    assert merged["sections"][1]["creators"] == ["UC1", "UC2"]


def test_delivery_defaults_and_custom_validation():
    merged = email_digest.merge_content("daily_brief", {})
    assert merged["delivery"] == {"mode": "approval", "audience": "subscribers", "emails": []}
    with pytest.raises(ValueError):
        email_digest.validate_content("daily_brief", {"delivery": {"audience": "custom", "emails": []}})
    with pytest.raises(ValueError):
        email_digest.validate_content("daily_brief", {"delivery": {"audience": "custom", "emails": ["not-an-email"]}})
    ok = email_digest.validate_content("daily_brief", {"delivery": {"mode": "auto", "audience": "custom", "emails": ["A@x.com", "a@x.com"]}})
    assert ok["delivery"] == {"mode": "auto", "audience": "custom", "emails": ["a@x.com"]}
