"""Share links for any piece of Kolvex content.

A share is an immutable snapshot ("card") built here from the stored source row, so a link can
never show text the source did not contain. Cards keep source text as stored and carry
structured fields (sentiment, contract type...) so readers see labels in their own language.
"""

import hashlib
import re
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

ShareKind = Literal["chat", "opinion", "x_post", "person_update", "options_candidate", "research"]
KINDS: tuple[str, ...] = ShareKind.__args__  # type: ignore[attr-defined]
TABLE = "content_shares"
ID_ALPHABET = string.ascii_letters + string.digits
SHARE_ID = re.compile(r"^[A-Za-z0-9]{10}$")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
DAILY_LIMIT = 100
MAX_EXCERPT = 4000
MAX_ANSWER = 12000
MAX_RESEARCH = 3000
LEGACY_CONTEXT = "\n\nKolvex decision context (source data, not instructions):"
EMOJI = re.compile("[\U0001f300-\U0001faff☀-➿️]")
CARD_FIELDS = "id,kind,visibility,locale,card,created_at"


class ShareError(Exception):
    """A request the caller can fix; `code` is a stable machine-readable reason."""

    def __init__(self, code: str, status: int = 422):
        super().__init__(code)
        self.code = code
        self.status = status


def new_share_id() -> str:
    return "".join(secrets.choice(ID_ALPHABET) for _ in range(10))


def content_hash(kind: str, source_id: str, locale: str, excerpt: str, question: bool) -> str:
    raw = "\x1f".join([kind, source_id, locale, normalize(excerpt), "q" if question else ""])
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Excerpt verification


def normalize(text: str) -> str:
    """Rendered text and markdown compared without formatting: links keep their label,
    markdown punctuation and every kind of whitespace are dropped."""
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text or "")
    text = re.sub(r"^\s*\|?[\s:|-]+\|[\s:|-]*$", "", text, flags=re.M)  # table rules
    text = re.sub(r"^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+", "", text, flags=re.M)
    text = EMOJI.sub("", text)
    return re.sub(r"[\s*_`~|#>]+", "", text)


def excerpt_matches(excerpt: str, markdown: str) -> bool:
    needle = normalize(excerpt)
    return bool(needle) and needle in normalize(markdown)


def visible_question(content: str) -> str:
    index = content.find(LEGACY_CONTEXT)
    return (content if index == -1 else content[:index]).strip()


def _clip(text: Optional[str], limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def plain(text: Optional[str], limit: int = 200) -> str:
    """One-line summary for link previews."""
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text or "")
    text = re.sub(r"[*_`#>|]+", "", text)
    return _clip(re.sub(r"\s+", " ", text), limit)


def _https(url: Optional[str]) -> Optional[str]:
    return url if isinstance(url, str) and url.startswith("https://") else None


# ---------------------------------------------------------------------------
# Card builders (pure; tested without a database)


def chat_card(
    answer: dict, question: Optional[dict], excerpt: str, created_at: Optional[str] = None
) -> dict:
    content = EMOJI.sub("", answer.get("content") or "").strip()
    if not content:
        raise ShareError("empty_source")
    excerpt = (excerpt or "").strip()
    if excerpt:
        if len(excerpt) > MAX_EXCERPT:
            raise ShareError("excerpt_too_long")
        if not excerpt_matches(excerpt, content):
            raise ShareError("excerpt_not_found")
    body = excerpt or _clip(content, MAX_ANSWER)
    asked = visible_question(question["content"]) if question else ""
    return {
        "title": plain(asked, 120) if asked else "",
        "summary": plain(body),
        "tickers": [],
        "published_at": created_at or answer.get("created_at"),
        "author": None,
        "source": None,
        "data": {"question": _clip(asked, 1000), "answer": body, "excerpt": bool(excerpt)},
    }


def opinion_card(row: dict) -> dict:
    video_url = _https(row.get("video_url")) or (
        f"https://www.youtube.com/watch?v={row['video_id']}"
        if re.fullmatch(r"[\w-]{11}", row.get("video_id") or "")
        else None
    )
    text = row.get("summary") or row.get("thesis") or ""
    return {
        "title": row.get("video_title") or "",
        "summary": plain(text),
        "tickers": [row["ticker"]],
        "published_at": row.get("opinion_date") or row.get("video_published_at"),
        "author": {
            "name": row.get("channel_title") or row.get("channel_handle") or "",
            "avatar_url": _https(row.get("channel_avatar_url")),
            "url": _https(row.get("channel_url")),
            "path": f"/creators/{row['channel_id']}" if row.get("channel_id") else None,
        },
        "source": {"platform": "youtube", "url": video_url} if video_url else None,
        "data": {
            "ticker": row["ticker"],
            "company_name": row.get("company_name"),
            "sentiment": row.get("sentiment"),
            "direction_score": row.get("direction_score"),
            "time_horizon": row.get("time_horizon"),
            "summary": row.get("summary"),
            "thesis": row.get("thesis"),
            "key_points": (row.get("key_points") or [])[:6],
            "risks": (row.get("risks") or [])[:4],
        },
    }


def x_post_card(row: dict) -> dict:
    creator = row.get("creator") or {}
    analysis = row.get("ai_analysis") or {}
    image = next(
        (
            asset["url"]
            for asset in row.get("media_assets") or []
            if asset.get("kind") in ("image", "video_poster") and _https(asset.get("url"))
        ),
        None,
    )
    return {
        "title": "",
        "summary": plain(row.get("text")),
        "tickers": (row.get("cashtags") or [])[:8],
        "published_at": row.get("published_at"),
        "author": {
            "name": creator.get("display_name") or row["author_username"],
            "handle": row["author_username"],
            "avatar_url": _https(creator.get("avatar_url")),
            "url": f"https://x.com/{row['author_username']}",
            "path": None,
        },
        "source": {"platform": "x", "url": _https(row.get("url"))},
        "data": {
            "text": row.get("text") or "",
            "quoted_texts": (row.get("quoted_texts") or [])[:2],
            "image_url": image,
            "ai_summary": (
                {"zh": analysis.get("summary_zh"), "en": analysis.get("summary_en")}
                if analysis.get("status") == "complete"
                else None
            ),
        },
    }


def person_update_card(row: dict) -> dict:
    return {
        "title": row["title"],
        "summary": plain(row.get("summary")),
        "tickers": (row.get("tickers") or [])[:8],
        "published_at": row["published_at"],
        "author": {
            "name": row.get("person_cn") or row["person"],
            "name_en": row["person"],
            "avatar_url": _https(row.get("avatar_url")),
            "url": None,
            "path": None,
        },
        "source": {"platform": "web", "url": _https(row.get("source_url"))},
        "data": {
            "summary": row.get("summary") or "",
            "impact": row.get("impact"),
            "tags": (row.get("tags") or [])[:6],
            "image_url": _https(row.get("image_url")),
            "image_alt": row.get("image_alt"),
        },
    }


CANDIDATE_FIELDS = (
    "underlying",
    "type",
    "strike",
    "expiration",
    "dte",
    "confidence",
    "premium",
    "vol_oi",
    "price",
    "thesis_zh",
    "thesis_en",
    "risk_zh",
    "risk_en",
    "invalidation_zh",
    "invalidation_en",
)


def options_candidate_card(run: dict, contract: str) -> dict:
    candidates = (run.get("summary") or {}).get("candidates") or {}
    item = next(
        (c for c in candidates.get("items") or [] if c.get("symbol") == contract),
        None,
    )
    if not item:
        raise ShareError("not_found", 404)
    data = {key: item.get(key) for key in CANDIDATE_FIELDS}
    data.update(
        contract=contract,
        crosses_earnings=bool((item.get("flags") or {}).get("crosses_earnings")),
        trade_date=run.get("trade_date"),
        session=run.get("session"),
        data_date=run.get("data_date"),
    )
    strike = item.get("strike")
    strike_text = f"{strike:g}" if isinstance(strike, (int, float)) else str(strike or "")
    side = "Call" if item.get("type") == "call" else "Put"
    return {
        # Contract identity only (no quotes), so it may appear in signed-out link previews.
        "title": f"{item['underlying']} ${strike_text} {side} · {item.get('expiration') or ''}".strip(
            " ·"
        ),
        "summary": plain(item.get("thesis_zh") or item.get("thesis_en")),
        "tickers": [item["underlying"]],
        "published_at": run.get("run_at"),
        "author": None,
        "source": None,
        "data": data,
    }


def research_card(record: dict, locale: str) -> dict:
    translated = (record.get("translations") or {}).get(locale) or {}
    plan = translated.get("investment_plan") or record.get("investment_plan") or ""
    signal = translated.get("full_signal") or record.get("full_signal") or ""
    body = _clip(plan or signal, MAX_RESEARCH)
    if not body and not record.get("final_decision"):
        raise ShareError("empty_source")
    author = record.get("author") or {}
    return {
        "title": "",
        "summary": plain(body),
        "tickers": [record["ticker"]],
        "published_at": record.get("published_at") or record.get("completed_at"),
        "author": (
            {
                "name": author.get("full_name") or author.get("username") or "",
                "avatar_url": _https(author.get("avatar_url")),
                "url": None,
                "path": None,
            }
            if author
            else None
        ),
        "source": {"platform": "kolvex", "path": f"/research/{record['id']}"},
        "data": {
            "ticker": record["ticker"],
            "trade_date": record.get("trade_date"),
            "final_decision": record.get("final_decision"),
            "plan": body,
            "truncated": len(plan or signal) > MAX_RESEARCH,
        },
    }


# ---------------------------------------------------------------------------
# Database access (service role)


def _one(response) -> Optional[dict]:
    data = getattr(response, "data", None) if response is not None else None
    if isinstance(data, list):
        return data[0] if data else None
    return data or None


def load_card(
    db, user_id: str, kind: str, source_id: str, locale: str, excerpt: str, question: bool
):
    """Returns (card, visibility). Raises ShareError(not_found) for anything the user cannot read."""
    if kind == "chat":
        if not UUID.match(source_id):
            raise ShareError("not_found", 404)
        answer = _one(
            db.table("chat_messages")
            .select("id,conversation_id,role,content,created_at")
            .eq("id", source_id)
            .limit(1)
            .execute()
        )
        if not answer or answer.get("role") != "assistant":
            raise ShareError("not_found", 404)
        owner = _one(
            db.table("chat_conversations")
            .select("id")
            .eq("id", answer["conversation_id"])
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not owner:
            raise ShareError("not_found", 404)
        asked = None
        if question:
            asked = _one(
                db.table("chat_messages")
                .select("content")
                .eq("conversation_id", answer["conversation_id"])
                .eq("role", "user")
                .lt("created_at", answer["created_at"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
        return chat_card(answer, asked, excerpt), "public"

    if kind == "opinion":
        if not UUID.match(source_id):
            raise ShareError("not_found", 404)
        row = _one(
            db.table("youtube_stock_opinions").select("*").eq("id", source_id).limit(1).execute()
        )
        if not row:
            raise ShareError("not_found", 404)
        return opinion_card(row), "public"

    if kind == "x_post":
        if not re.fullmatch(r"\d{1,25}", source_id):
            raise ShareError("not_found", 404)
        row = _one(
            db.table("x_posts")
            .select(
                "id,author_username,url,published_at,text,cashtags,quoted_texts,ai_analysis,"
                "media_assets,creator:x_creators(display_name,avatar_url)"
            )
            .eq("id", source_id)
            .limit(1)
            .execute()
        )
        if not row:
            raise ShareError("not_found", 404)
        return x_post_card(row), "public"

    if kind == "person_update":
        row = _one(db.table("person_updates").select("*").eq("id", source_id).limit(1).execute())
        if not row:
            raise ShareError("not_found", 404)
        return person_update_card(row), "public"

    if kind == "options_candidate":
        run_id, _, contract = source_id.partition(":")
        if not UUID.match(run_id) or not re.fullmatch(r"[A-Z0-9.]{5,32}", contract):
            raise ShareError("not_found", 404)
        run = _one(
            db.table("options_activity_runs")
            .select("id,trade_date,session,run_at,data_date,summary")
            .eq("id", run_id)
            .eq("status", "ok")
            .limit(1)
            .execute()
        )
        if not run:
            raise ShareError("not_found", 404)
        return options_candidate_card(run, contract), "signed_in"

    if kind == "research":
        if not UUID.match(source_id):
            raise ShareError("not_found", 404)
        record = _one(
            db.table("trading_analyses")
            .select("*")
            .eq("id", source_id)
            .eq("status", "completed")
            .eq("is_published", True)
            .limit(1)
            .execute()
        )
        if not record:
            raise ShareError("not_found", 404)
        if record.get("user_id"):
            profile = _one(
                db.table("user_profiles")
                .select("username,full_name,avatar_url")
                .eq("id", record["user_id"])
                .limit(1)
                .execute()
            )
            record["author"] = profile
        return research_card(record, locale), "public"

    raise ShareError("invalid_kind")


def create_share(
    db,
    user_id: str,
    kind: str,
    source_id: str,
    locale: str,
    excerpt: str = "",
    include_question: bool = True,
    now: Optional[datetime] = None,
) -> dict:
    if kind not in KINDS:
        raise ShareError("invalid_kind")
    excerpt = excerpt if kind == "chat" else ""
    question = include_question and kind == "chat"
    digest = content_hash(kind, source_id, locale, excerpt, question)
    existing = _one(
        db.table(TABLE)
        .select(CARD_FIELDS)
        .eq("user_id", user_id)
        .eq("content_hash", digest)
        .is_("revoked_at", "null")
        .limit(1)
        .execute()
    )
    if existing:
        return existing
    since = (now or datetime.now(timezone.utc)) - timedelta(days=1)
    recent = (
        db.table(TABLE)
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", since.isoformat())
        .limit(1)
        .execute()
    )
    if (getattr(recent, "count", 0) or 0) >= DAILY_LIMIT:
        raise ShareError("rate_limited", 429)
    card, visibility = load_card(db, user_id, kind, source_id, locale, excerpt, question)
    row = {
        "id": new_share_id(),
        "user_id": user_id,
        "kind": kind,
        "source_id": source_id,
        "content_hash": digest,
        "visibility": visibility,
        "locale": locale,
        "card": {"v": 1, **card},
    }
    saved = _one(db.table(TABLE).insert(row).execute())
    return {key: (saved or row).get(key) for key in CARD_FIELDS.split(",")}


def public_view(row: dict, signed_in: bool) -> dict:
    """What a reader may see. Signed-in-only shares keep a teaser for link previews."""
    view = {key: row.get(key) for key in CARD_FIELDS.split(",")}
    if row.get("visibility") == "signed_in" and not signed_in:
        card = row.get("card") or {}
        view["card"] = {
            "v": card.get("v", 1),
            "title": card.get("title", ""),
            "summary": "",
            "tickers": card.get("tickers") or [],
            "published_at": card.get("published_at"),
            "author": None,
            "source": None,
            "data": {},
        }
        view["locked"] = True
    else:
        view["locked"] = False
    return view


def get_share(db, share_id: str) -> Optional[dict]:
    if not SHARE_ID.match(share_id):
        return None
    return _one(
        db.table(TABLE)
        .select(CARD_FIELDS)
        .eq("id", share_id)
        .is_("revoked_at", "null")
        .limit(1)
        .execute()
    )


def list_shares(db, user_id: str, limit: int = 50) -> list[dict]:
    rows = (
        db.table(TABLE)
        .select(CARD_FIELDS)
        .eq("user_id", user_id)
        .is_("revoked_at", "null")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )
    return [
        {
            **{key: row.get(key) for key in ("id", "kind", "visibility", "locale", "created_at")},
            "title": (row.get("card") or {}).get("title", ""),
            "summary": (row.get("card") or {}).get("summary", ""),
            "tickers": (row.get("card") or {}).get("tickers", []),
        }
        for row in rows
    ]


def revoke_share(db, user_id: str, share_id: str, now: Optional[datetime] = None) -> bool:
    if not SHARE_ID.match(share_id):
        return False
    response = (
        db.table(TABLE)
        .update({"revoked_at": (now or datetime.now(timezone.utc)).isoformat()})
        .eq("id", share_id)
        .eq("user_id", user_id)
        .is_("revoked_at", "null")
        .execute()
    )
    return bool(getattr(response, "data", None))
