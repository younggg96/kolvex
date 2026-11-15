"""Chat memory beyond the recent messages.

Two parts, both written by the backend after a reply is saved (never on the answer's path):

- Long conversations: once a conversation has SUMMARY_TRIGGER messages after its summary, a
  fast model folds all but the newest MAX_CONTEXT_MESSAGES of them into
  chat_conversations.summary, and summary_until moves to the last folded message. The model
  then sees the summary plus every message after it (at most SUMMARY_TRIGGER - 1 of them).
  Figures are left out of summaries: an answer's numbers are checked only against this turn's
  tool results, so remembered prices or financials would be stale and unverifiable.
- Across conversations: chat_user_memory keeps the language of the user's messages and the
  tickers their tool calls looked up. No model is called for this, and users can read and
  clear it (GET / DELETE /api/v1/chat/memory).

Everything here is best effort. If the migration (20261115000000_chat_memory.sql) is not
applied or the database fails, the chat falls back to the newest messages and no memory.
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.config import MAX_CONTEXT_MESSAGES

logger = logging.getLogger(__name__)

SUMMARY_BATCH = 10  # summarise every 10 messages (about five turns), not every turn
SUMMARY_TRIGGER = MAX_CONTEXT_MESSAGES + SUMMARY_BATCH
SUMMARY_MAX_CHARS = 2000
SUMMARY_MESSAGE_CHARS = 1500  # each folded message is cut to this before summarising
MAX_TICKERS = 40
SHOWN_TICKERS = 8
TICKER_KEYS = ("symbol", "ticker", "symbols", "tickers")
_TICKER = re.compile(r"^[A-Z][A-Z0-9]{0,5}([.\-][A-Z0-9]{1,3})?$")
_CJK = re.compile(r"[㐀-鿿]")
_LATIN = re.compile(r"[A-Za-z]")

SUMMARY_PROMPT = """You maintain a running summary of a conversation between a user and Kolvex AI, \
a US stock research assistant. Update the previous summary with the new messages.

Keep: what the user wants to find out, which companies and tickers were discussed, the questions \
asked and what the assistant concluded, and any preferences the user stated (answer length, \
holding period, risk, language).
Leave out every figure: prices, returns, revenue, margins, ratios, targets and dates of quotes. \
They change and must be fetched again. Write "the assistant gave NVDA's latest revenue", not the amount.
Do not add anything that is not in the messages. Write in the language the user mostly uses, \
at most 200 words, as plain sentences with no heading."""


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def detect_language(text: str) -> Optional[str]:
    """'zh' when the message has Chinese characters, 'en' for plain English, else None."""
    if len(_CJK.findall(text or "")) >= 2:
        return "zh"
    if len(_LATIN.findall(text or "")) >= 8 and not _CJK.search(text or ""):
        return "en"
    return None


def tickers_from_tool_inputs(inputs: Iterable[Any]) -> list[str]:
    """Tickers named in tool-call arguments, in order, without repeats."""
    found: list[str] = []
    for item in inputs:
        if not isinstance(item, dict):
            continue
        for key in TICKER_KEYS:
            value = item.get(key)
            values = value if isinstance(value, list) else [value]
            for raw in values:
                if not isinstance(raw, str):
                    continue
                for part in raw.split(","):
                    symbol = part.strip().upper()
                    if _TICKER.match(symbol) and symbol not in found:
                        found.append(symbol)
    return found


def merge_tickers(current: dict[str, Any], new: list[str], today: str) -> dict[str, Any]:
    """Count this turn's tickers once each; keep the MAX_TICKERS most used, then most recent."""
    merged = {k: dict(v) for k, v in (current or {}).items() if isinstance(v, dict)}
    for symbol in new:
        entry = merged.setdefault(symbol, {"count": 0})
        entry["count"] = int(entry.get("count") or 0) + 1
        entry["last"] = today
    ranked = sorted(
        merged.items(), key=lambda kv: (kv[1].get("count", 0), kv[1].get("last", "")), reverse=True
    )
    return dict(ranked[:MAX_TICKERS])


def usual_tickers(tickers: dict[str, Any], limit: int = SHOWN_TICKERS) -> list[str]:
    ranked = sorted(
        (kv for kv in (tickers or {}).items() if isinstance(kv[1], dict)),
        key=lambda kv: (kv[1].get("count", 0), kv[1].get("last", "")),
        reverse=True,
    )
    return [symbol for symbol, _ in ranked[:limit]]


def memory_note(summary: Optional[str], user_memory: Optional[dict[str, Any]]) -> Optional[str]:
    """Prompt text for what the model should know beyond the recent messages."""
    parts: list[str] = []
    if summary and summary.strip():
        parts.append(
            "Summary of the earlier part of this conversation (older messages are not shown). "
            "It has no figures on purpose: fetch any number you need with tools.\n"
            + summary.strip()
        )
    lines: list[str] = []
    language = (user_memory or {}).get("language")
    if language in ("zh", "en"):
        name = "Chinese" if language == "zh" else "English"
        lines.append(
            f"- Their recent messages are in {name}. Still answer in the language of the current "
            f"message; use {name} only when the message has no clear language (for example just a ticker)."
        )
    tickers = usual_tickers((user_memory or {}).get("tickers") or {})
    if tickers:
        lines.append(
            "- Tickers they looked up most in earlier chats: " + ", ".join(tickers) + ". "
            "This is not their watchlist or portfolio; use the tools for those."
        )
    if lines:
        parts.append(
            "What Kolvex remembers about this user from earlier conversations. Use it only to read "
            "vague requests; it is not data and not a reason to bring these stocks up:\n"
            + "\n".join(lines)
        )
    return "\n\n".join(parts) or None


def summary_input(previous: Optional[str], messages: list[dict[str, Any]]) -> str:
    lines = []
    for message in messages:
        text = " ".join(str(message.get("content") or "").split())
        if len(text) > SUMMARY_MESSAGE_CHARS:
            text = text[:SUMMARY_MESSAGE_CHARS] + "…"
        lines.append(f"{message.get('role', 'user')}: {text}")
    return (
        f"Previous summary:\n{previous.strip() if previous and previous.strip() else '(none)'}\n\n"
        "New messages:\n" + "\n".join(lines)
    )


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


# ---------------------------------------------------------------------------
# Database (service role; the caller has already checked the conversation is the user's)
# ---------------------------------------------------------------------------


def _db():
    from app.core.supabase import get_supabase_service

    return get_supabase_service()


async def load_user_memory(user_id: str) -> Optional[dict[str, Any]]:
    try:
        result = await asyncio.to_thread(
            _db().table("chat_user_memory").select("language, tickers, updated_at")
            .eq("user_id", user_id).limit(1).execute
        )  # fmt: skip
        return (result.data or [None])[0]
    except Exception as error:  # noqa: BLE001 - a missing table or DB error never blocks the chat
        logger.info("Chat user memory skipped: %s", error)
        return None


async def _conversation(user_id: str, conversation_id: str) -> Optional[dict[str, Any]]:
    """The user's conversation row with its summary columns; None if not theirs or unavailable."""
    try:
        result = await asyncio.to_thread(
            _db().table("chat_conversations").select("id, summary, summary_until")
            .eq("id", conversation_id).eq("user_id", user_id).limit(1).execute
        )  # fmt: skip
        return (result.data or [None])[0]
    except Exception as error:  # noqa: BLE001
        logger.info("Conversation summary skipped: %s", error)
        return None


async def load_summary(user_id: str, conversation_id: str) -> tuple[Optional[str], Optional[str]]:
    """(summary, summary_until) of the user's conversation, or (None, None)."""
    row = await _conversation(user_id, conversation_id) or {}
    return row.get("summary"), row.get("summary_until")


async def load_memory_note(user_id: str, conversation_id: str) -> Optional[str]:
    (summary, _), user_memory = await asyncio.gather(
        load_summary(user_id, conversation_id), load_user_memory(user_id)
    )
    return memory_note(summary, user_memory)


async def remember_user(user_id: str, user_text: str, tickers: list[str]) -> None:
    """Update the cross-conversation memory after a turn."""
    language = detect_language(user_text)
    if not language and not tickers:
        return
    try:
        current = await load_user_memory(user_id) or {}
        row: dict[str, Any] = {
            "user_id": user_id,
            "language": language or current.get("language"),
            "tickers": merge_tickers(current.get("tickers") or {}, tickers, _today()),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await asyncio.to_thread(_db().table("chat_user_memory").upsert(row).execute)
    except Exception as error:  # noqa: BLE001
        logger.info("Chat user memory not saved: %s", error)


async def refresh_summary(
    user_id: str, conversation_id: str, user_api_keys: Optional[dict[str, str]] = None
) -> bool:
    """Fold older messages into the summary when enough have built up. True when it did."""
    try:
        conversation = await _conversation(user_id, conversation_id)
        if not conversation:
            return False
        summary, until = conversation.get("summary"), conversation.get("summary_until")
        query = (
            _db().table("chat_messages").select("role, content, created_at")
            .eq("conversation_id", conversation_id)
        )  # fmt: skip
        if until:
            query = query.gt("created_at", until)
        result = await asyncio.to_thread(
            query.order("created_at").limit(SUMMARY_TRIGGER * 4).execute
        )
        messages = result.data or []
        if len(messages) < SUMMARY_TRIGGER:
            return False
        folded = messages[: len(messages) - MAX_CONTEXT_MESSAGES]

        from app.agent.llm import get_fast_llm

        response = await get_fast_llm(user_api_keys=user_api_keys).ainvoke(
            [
                SystemMessage(content=SUMMARY_PROMPT),
                HumanMessage(content=summary_input(summary, folded)),
            ]
        )
        text = response.content if isinstance(response.content, str) else str(response.content)
        text = text.strip()[:SUMMARY_MAX_CHARS]
        if not text:
            return False
        await asyncio.to_thread(
            _db().table("chat_conversations")
            .update({"summary": text, "summary_until": folded[-1]["created_at"]})
            .eq("id", conversation_id).eq("user_id", user_id).execute
        )  # fmt: skip
        return True
    except Exception as error:  # noqa: BLE001
        logger.warning("Conversation summary not refreshed for %s: %s", conversation_id, error)
        return False


async def remember_turn(
    user_id: str,
    conversation_id: str,
    user_text: str,
    tickers: list[str],
    user_api_keys: Optional[dict[str, str]] = None,
) -> None:
    await asyncio.gather(
        remember_user(user_id, user_text, tickers),
        refresh_summary(user_id, conversation_id, user_api_keys),
    )


_background: set[asyncio.Task] = set()


def remember_turn_later(*args: Any, **kwargs: Any) -> None:
    """Run remember_turn after the reply, without holding up the response."""
    task = asyncio.create_task(remember_turn(*args, **kwargs))
    _background.add(task)
    task.add_done_callback(_background.discard)


async def clear_user_memory(user_id: str) -> None:
    await asyncio.to_thread(_db().table("chat_user_memory").delete().eq("user_id", user_id).execute)
