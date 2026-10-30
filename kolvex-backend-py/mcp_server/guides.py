"""Small authoring examples; the existing backend remains the validator."""
from typing import Literal

ContentKind = Literal["brief", "creator", "opinion", "youtube_import", "market_events"]

GUIDES = {
    "brief": {
        "instructions": [
            "Use morning, intraday or evening. brief.id must equal {type}-{date}.",
            "Dates are Pacific issue dates. generated_at_pt needs the actual Pacific UTC offset.",
            "Read get_brief before editing. Send the entire payload and its revision to update_brief.",
            "Create/update is immediately visible through the existing reader API; there is no draft status for briefs.",
            "translations may contain the other language with title, headline and sections; never identity fields.",
            "Validation normalizes numbers and checks URLs. Never put account or portfolio data in briefs.",
        ],
        "example": {
            "schema_version": "kolvex-brief/1.0",
            "language": "zh",
            "brief": {
                "id": "intraday-2026-10-29", "type": "intraday", "date": "2026-10-29",
                "title": "格式示例：盘中简报", "headline": "请替换为已核实的内容",
                "generated_at_pt": "2026-10-29T10:00:00-07:00", "market_status": "trading_day",
            },
            "sections": [{"section_id": "outlook", "order": 1, "title": "关注事项", "narrative": "格式示例，不是市场事实。"}],
        },
    },
    "creator": {
        "instructions": [
            "Use list_creators to get channel_id. Only existing imported creators can be edited.",
            "Only supplied fields change. null clears an optional field. Omit fields you want to preserve.",
            "Supported fields: channel_title, channel_handle, channel_url, channel_avatar_url.",
            "The current backend has no creator biography field or standalone creator creation endpoint.",
        ],
        "example": {"channel_title": "Creator name", "channel_handle": "@creator"},
    },
    "opinion": {
        "instructions": [
            "Use list_creator_opinions to read IDs and current content before editing.",
            "create_opinion/update_opinion take an entire OpinionWrite object; update is not a sparse patch.",
            "Keep omitted original fields when editing; the backend may reset them to defaults.",
            "Writes are immediately visible. No draft/publish state exists for opinions.",
        ],
        "example": {"ticker": "AAPL", "sentiment": "bullish", "summary": "格式示例，请替换为创作者的实际观点。", "key_points": [], "risks": []},
    },
    "youtube_import": {
        "instructions": [
            "Accepts one externally generated video analysis object or an array of those objects.",
            "Call validate_youtube_import first; its errors explain the required import fields.",
            "Import does not scrape YouTube or generate analysis. Use create_opinion for individual editorial entries.",
            "Import changes visible website content immediately. Do not retry an ambiguous timeout without reading back.",
            "For each supplied video, import replaces ALL existing opinions, deleting omitted tickers. Other videos are preserved.",
            "The backend verifies YouTube publication times/channel identity; that external check may fail without saving.",
        ],
        "example": {
            "channel": {"id": "UC_REPLACE_WITH_REAL_ID", "title": "Creator name"},
            "video": {"id": "REPLACE_WITH_REAL_VIDEO_ID", "title": "Video title", "published_at": "2026-10-29T16:00:00Z"},
            "opinions": [{"ticker": "AAPL", "sentiment": "neutral", "summary": "格式示例，请替换为视频中的实际观点。"}],
        },
    },
    "market_events": {
        "instructions": [
            "schema_version=kolvex-market-events/1.0; timezone=America/New_York.",
            "Use stable IDs. Saving an existing ID fully replaces that event; omitted IDs are preserved.",
            "status is draft, published or cancelled. New events default to draft.",
            "To publish or take down, read the current event then save its full content with the new status.",
            "scheduled needs starts_at with UTC offset matching event_date in New York; other timings need null.",
            "Public calendar shows only published high-importance/hot events within its three-week window.",
            "Maximum 200 events / 1 MB. Concurrent saves use last-write-wins; refresh before changing content.",
        ],
        "example": {
            "schema_version": "kolvex-market-events/1.0", "timezone": "America/New_York",
            "events": [{"id": "example-event", "title": "格式示例：待核实事件", "category": "other", "event_date": "2026-10-29", "timing": "tbd", "status": "draft"}],
        },
    },
}
