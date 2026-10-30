"""Source-preserving X imports. No scraping, sentiment inference or credential storage."""

import json
import re
from datetime import datetime, timezone
from urllib.parse import urlparse


HANDLE = re.compile(r"[A-Za-z0-9_]{1,15}")
POST_ID = re.compile(r"[1-9][0-9]{0,24}")
TICKER = re.compile(r"[A-Z][A-Z0-9.\-]{0,14}")
METRICS = ("replies", "reposts", "likes", "bookmarks", "views")


def username(value):
    if not isinstance(value, str):
        raise ValueError("Username must be text")
    value = value.strip().removeprefix("@")
    if not HANDLE.fullmatch(value):
        raise ValueError("Use an X username with 1–15 letters, numbers or underscores")
    return value.lower()


def normalize_import(payload):
    if len(json.dumps(payload, ensure_ascii=False).encode()) > 2 * 1024 * 1024:
        raise ValueError("Import exceeds 2 MB")
    posts = payload.get("posts") if isinstance(payload, dict) else payload
    if not isinstance(posts, list) or not 1 <= len(posts) <= 500:
        raise ValueError("Provide an array or an export object containing 1–500 posts")
    result = []
    seen = set()
    for index, post in enumerate(posts, 1):
        try:
            if not isinstance(post, dict):
                raise ValueError("Post must be an object")
            post_id = post.get("id")
            if not isinstance(post_id, str) or not POST_ID.fullmatch(post_id):
                raise ValueError("id must be a decimal string, never a JSON number")
            author = username(post.get("author_username"))
            if post_id in seen:
                raise ValueError("Duplicate post ID within this import")
            seen.add(post_id)
            text = post.get("text")
            if not isinstance(text, str) or not text.strip() or len(text) > 50000:
                raise ValueError("text must contain 1–50000 characters")
            published = post.get("published_at")
            if not isinstance(published, str):
                raise ValueError("published_at is required")
            dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
            if dt.tzinfo is None or dt.utcoffset() is None:
                raise ValueError("published_at must include a timezone")
            url = f"https://x.com/{author}/status/{post_id}"
            supplied_url = post.get("url", url)
            if not isinstance(supplied_url, str):
                raise ValueError("url must be an X post URL")
            parsed = urlparse(supplied_url)
            if (parsed.scheme != "https" or parsed.netloc.lower() not in ("x.com", "www.x.com", "twitter.com", "www.twitter.com")
                    or parsed.path.lower().rstrip("/") != f"/{author}/status/{post_id}"):
                raise ValueError("url must match the post author and ID")
            tags = post.get("cashtags", re.findall(r"\$([A-Za-z][A-Za-z0-9.\-]{0,14})\b", text))
            if not isinstance(tags, list) or len(tags) > 100:
                raise ValueError("cashtags must be an array of at most 100 tickers")
            normalized_tags = []
            for tag in tags:
                if not isinstance(tag, str) or not TICKER.fullmatch(tag.upper().removeprefix("$")):
                    raise ValueError("Invalid cashtag")
                normalized_tags.append(tag.upper().removeprefix("$"))
            metrics = post.get("metrics")
            if metrics is None:
                metrics = {}
            if not isinstance(metrics, dict):
                raise ValueError("metrics must be an object")
            clean_metrics = {}
            for key in METRICS:
                value = metrics.get(key)
                if value is not None and (type(value) is not int or not 0 <= value <= 2**53 - 1):
                    raise ValueError(f"metrics.{key} must be a nonnegative safe integer or null")
                clean_metrics[key] = value
            quoted = post.get("quoted_texts", [])
            if not isinstance(quoted, list) or len(quoted) > 20 or any(not isinstance(q, str) or len(q) > 50000 for q in quoted):
                raise ValueError("quoted_texts must contain at most 20 text strings")
            links = post.get("media_links", [])
            if not isinstance(links, list) or len(links) > 20:
                raise ValueError("media_links must contain at most 20 X photo/video links")
            for link in links:
                if not isinstance(link, str) or not re.fullmatch(r"https://(?:www\.)?(?:x|twitter)\.com/[A-Za-z0-9_]{1,15}/status/[1-9][0-9]{0,24}/(?:photo|video)/[1-9][0-9]?", link):
                    raise ValueError("Invalid X media page link")
            for flag in ("truncated", "pinned"):
                if flag in post and type(post[flag]) is not bool:
                    raise ValueError(f"{flag} must be boolean")
            result.append({"id": post_id, "author_username": author, "url": url,
                           "published_at": dt.astimezone(timezone.utc).isoformat(), "text": text,
                           "cashtags": sorted(set(normalized_tags)), "metrics": clean_metrics,
                           "quoted_texts": quoted, "media_links": links,
                           "truncated": post.get("truncated", False), "pinned": post.get("pinned", False)})
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Post {index}: {exc}") from exc
    return result


class XContentService:
    def __init__(self, db):
        self.db = db

    def creators(self):
        return {"creators": self.db.table("x_creators").select("*").order("username").execute().data or []}

    def save_creator(self, handle, display_name, bio):
        handle = username(handle)
        return {"creator": self.db.table("x_creators").upsert({
            "username": handle, "display_name": display_name.strip() or handle,
            "bio": bio.strip(),
        }, on_conflict="username").execute().data[0]}

    def posts(self, author=None, ticker=None, limit=20, offset=0):
        query = self.db.table("x_posts").select("*,creator:x_creators(display_name,bio)", count="exact")
        if author:
            query = query.eq("author_username", username(author))
        if ticker:
            ticker = ticker.upper().removeprefix("$")
            if not TICKER.fullmatch(ticker):
                raise ValueError("Invalid ticker")
            query = query.contains("cashtags", [ticker])
        response = query.order("published_at", desc=True).order("id", desc=True).range(offset, offset + limit - 1).execute()
        return {"posts": response.data or [], "total": response.count or 0, "limit": limit, "offset": offset}

    def validate(self, payload):
        posts = normalize_import(payload)
        return {"total": len(posts), "authors": sorted({p["author_username"] for p in posts}),
                "tickers": sorted({t for p in posts for t in p["cashtags"]}),
                "truncated": sum(p["truncated"] for p in posts)}

    def upload(self, payload):
        posts = normalize_import(payload)
        # One transaction: creators and posts either both commit or both roll back.
        result = self.db.rpc("import_x_posts", {"posts": posts}).execute().data
        return {"total": len(posts), "inserted": result["inserted"], "skipped": len(posts) - result["inserted"]}
