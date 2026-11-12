"""
Daily Brief Tools
让 Agent 读取站内日报 (daily_briefs)：盘前/盘中/盘后的最新市场热点
"""

import json
import logging
from typing import Literal, Optional

from langchain_core.tools import tool

from app.core.supabase import get_supabase_service
from app.services.daily_briefs import Envelope

logger = logging.getLogger(__name__)

_MAX_CHARS = 12000


def _text(value) -> str:
    if isinstance(value, list):
        return "\n".join(str(v) for v in value if v)
    return str(value or "")


def _digest(payload: dict, language: str) -> str:
    """把日报 JSON 压成适合 LLM 阅读的纯文本，去掉图片等无关字段。"""
    env = Envelope.model_validate(payload)
    loc = env.translations.get(language) if language != env.language else None
    title = loc.title if loc else env.brief.title
    headline = loc.headline if loc else env.brief.headline
    sections = loc.sections if loc else env.sections

    lines = [f"# {title}", f"{env.brief.type} brief · {env.brief.date} · generated {env.brief.generated_at_pt}", headline]
    for s in sections:
        lines.append(f"\n## {s.title}" + (f" — {s.subtitle}" if s.subtitle else ""))
        for part in (_text(s.narrative), _text(s.paragraphs)):
            if part:
                lines.append(part)
        for i in s.indices:
            lines.append(f"- {i.name}: close {i.close} ({i.change_pct}%)" + (f" {i.note}" if i.note else ""))
        for label, movers in (("Up", s.movers_up), ("Down", s.movers_down), ("Commodity", s.commodities)):
            for m in movers:
                lines.append(f"- [{label}] {m.name}: {m.detail}")
        for it in s.items:
            head = f"- **{it.title}**"
            if it.related_tickers:
                head += f" [{', '.join(it.related_tickers)}]"
            lines.append(head)
            if it.summary:
                lines.append(f"  {it.summary}")
            if it.key_stats:
                lines.append("  " + "; ".join(f"{k.label}: {k.value}" for k in it.key_stats))
            if it.impact and (it.impact.short_term or it.impact.long_term):
                lines.append(f"  Impact: {it.impact.short_term} {it.impact.long_term}".rstrip())
            if it.sources:
                lines.append("  Sources: " + ", ".join(f"{src.name} ({src.url})" for src in it.sources[:3]))
        for e in s.events:
            lines.append(f"- {e.date_label} {e.title}: {e.detail}")
        if s.takeaway:
            lines.append(f"Takeaway: {s.takeaway}")
    text = "\n".join(lines)
    return text if len(text) <= _MAX_CHARS else text[:_MAX_CHARS] + "\n…(truncated)"


@tool
def get_daily_brief(
    brief_type: Optional[Literal["morning", "intraday", "evening"]] = None,
    date: Optional[str] = None,
    language: Literal["zh", "en"] = "zh",
) -> str:
    """Get Kolvex's in-site daily market brief (日报): the latest market hot topics, news,
    index moves, top movers, related tickers and upcoming events, curated by the Kolvex editors.

    Call this whenever the user asks about the 日报 / daily brief / today's market news, hot topics,
    what happened in the market, or wants news context. Omit all arguments for the most recent brief.

    Args:
        brief_type: "morning" (盘前), "intraday" (盘中) or "evening" (盘后). Omit for the latest of any type.
        date: Brief date in YYYY-MM-DD. Omit for the most recent date.
        language: Language to return when a translation exists ("zh" or "en").
    """
    try:
        query = get_supabase_service().table("daily_briefs").select("id,payload")
        if brief_type:
            query = query.eq("brief_type", brief_type)
        if date:
            query = query.eq("brief_date", date)
        result = query.order("brief_date", desc=True).order("created_at", desc=True).limit(1).execute()
    except Exception as e:
        logger.error(f"Error loading daily brief: {e}", exc_info=True)
        return json.dumps({"status": "error", "message": "The daily brief is temporarily unavailable."})

    if not result.data:
        return json.dumps({"status": "empty", "message": "No daily brief matches that type/date."})
    try:
        return _digest(result.data[0]["payload"], language)
    except Exception as e:
        logger.error(f"Invalid daily brief {result.data[0].get('id')}: {e}", exc_info=True)
        return json.dumps({"status": "error", "message": "The daily brief could not be read."})
