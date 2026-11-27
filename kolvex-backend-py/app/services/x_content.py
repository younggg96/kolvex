"""Source-preserving X imports. No scraping, sentiment inference or credential storage."""

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

HANDLE = re.compile(r"[A-Za-z0-9_]{1,15}")
POST_ID = re.compile(r"[1-9][0-9]{0,24}")
TICKER = re.compile(r"[A-Z][A-Z0-9.\-]{0,14}")
AVATAR = re.compile(
    r"https://pbs\.twimg\.com/profile_images/[0-9]+/[A-Za-z0-9_\-]+\.(?:jpg|jpeg|png|webp|gif)"
)
CREATOR_FIELDS = "username,display_name,bio,avatar_url,location,website,followers_count,following_count,created_at"
POST_FIELDS = "id,author_username,url,published_at,text,cashtags,metrics,quoted_texts,media_links,truncated,pinned,imported_at,ai_analysis,media_assets"
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
            if (
                parsed.scheme != "https"
                or parsed.netloc.lower()
                not in ("x.com", "www.x.com", "twitter.com", "www.twitter.com")
                or parsed.path.lower().rstrip("/") != f"/{author}/status/{post_id}"
            ):
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
            if (
                not isinstance(quoted, list)
                or len(quoted) > 20
                or any(not isinstance(q, str) or len(q) > 50000 for q in quoted)
            ):
                raise ValueError("quoted_texts must contain at most 20 text strings")
            links = post.get("media_links", [])
            if not isinstance(links, list) or len(links) > 20:
                raise ValueError("media_links must contain at most 20 X photo/video links")
            for link in links:
                if not isinstance(link, str) or not re.fullmatch(
                    r"https://(?:www\.)?(?:x|twitter)\.com/[A-Za-z0-9_]{1,15}/status/[1-9][0-9]{0,24}/(?:photo|video)/[1-9][0-9]?",
                    link,
                ):
                    raise ValueError("Invalid X media page link")
            for flag in ("truncated", "pinned"):
                if flag in post and type(post[flag]) is not bool:
                    raise ValueError(f"{flag} must be boolean")
            result.append(
                {
                    "id": post_id,
                    "author_username": author,
                    "url": url,
                    "published_at": dt.astimezone(timezone.utc).isoformat(),
                    "text": text,
                    "cashtags": sorted(set(normalized_tags)),
                    "metrics": clean_metrics,
                    "quoted_texts": quoted,
                    "media_links": links,
                    "truncated": post.get("truncated", False),
                    "pinned": post.get("pinned", False),
                }
            )
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Post {index}: {exc}") from exc
    return result


class XContentService:
    def __init__(self, db):
        self.db = db

    def creators(self, limit=1000, offset=0):
        rows = (
            self.db.table("x_creators")
            .select(CREATOR_FIELDS)
            .order("username")
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"creators": rows.data or [], "limit": limit, "offset": offset}

    def summaries(self, author=None):
        """Saved AI-authored snapshot; reading never calls a model or mutates posts."""
        author = username(author) if author else None
        path = Path(__file__).resolve().parents[2] / "data" / "x_creator_summaries.json"
        snapshot = json.loads(path.read_text())
        records = [row for row in snapshot["summaries"] if not author or row["username"] == author]
        ids = [post_id for row in records for post_id in row["source_ids"]]
        if not ids:
            return {
                "generated_at": snapshot["generated_at"],
                "coverage": "partial",
                "summaries": [],
            }
        rows = (
            self.db.table("x_posts")
            .select("id,author_username,url,published_at")
            .in_("id", ids)
            .execute()
            .data
            or []
        )
        posts = {row["id"]: row for row in rows}
        result = []
        for record in records:
            sources = [posts.get(post_id) for post_id in record["source_ids"]]
            # Never display an insight without all of its original evidence.
            if not all(
                source and source["author_username"].lower() == record["username"]
                for source in sources
            ):
                continue
            result.append(
                {
                    "username": record["username"],
                    "content": record["content"],
                    "sources": sources,
                    "coverage_start": min(source["published_at"] for source in sources),
                    "coverage_end": max(source["published_at"] for source in sources),
                }
            )
        return {
            "generated_at": snapshot["generated_at"],
            "coverage": "partial",
            "summaries": result,
        }

    def save_creator(self, handle, display_name, bio, **profile):
        handle = username(handle)
        for field in ("avatar_url", "website"):
            if profile.get(field):
                parsed = urlparse(profile[field])
                if (
                    parsed.scheme != "https"
                    or not parsed.hostname
                    or parsed.username
                    or parsed.password
                ):
                    raise ValueError(f"{field} must be a public HTTPS URL")
        return {
            "creator": self.db.table("x_creators")
            .upsert(
                {
                    "username": handle,
                    "display_name": display_name.strip() or handle,
                    "bio": bio.strip(),
                    **profile,
                },
                on_conflict="username",
            )
            .execute()
            .data[0]
        }

    def fill_profile(self, profile):
        """Fill a creator's empty avatar, display name or bio from their public profile header.

        Never overwrites a value an administrator set, and never creates a creator that has
        no imported posts. Returns the field names that were filled.
        """
        handle = username(profile.get("username", ""))
        rows = (
            self.db.table("x_creators")
            .select("display_name,bio,avatar_url")
            .eq("username", handle)
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return []
        current, changes = rows[0], {}
        avatar = profile.get("avatar_url")
        if (
            not current.get("avatar_url")
            and isinstance(avatar, str)
            and len(avatar) <= 2048
            and AVATAR.fullmatch(avatar)
        ):
            changes["avatar_url"] = avatar
        name = profile.get("display_name")
        if (
            current.get("display_name") in (None, "", handle)
            and isinstance(name, str)
            and 1 <= len(name.strip()) <= 100
        ):
            changes["display_name"] = name.strip()
        bio = profile.get("bio")
        if not current.get("bio") and isinstance(bio, str) and 1 <= len(bio.strip()) <= 1000:
            changes["bio"] = bio.strip()
        if changes:
            self.db.table("x_creators").update(changes).eq("username", handle).execute()
        return sorted(changes)

    def posts(self, author=None, ticker=None, limit=20, offset=0):
        query = self.db.table("x_posts").select(
            f"{POST_FIELDS},creator:x_creators({CREATOR_FIELDS})", count="exact"
        )
        if author:
            query = query.eq("author_username", username(author))
        if ticker:
            ticker = ticker.upper().removeprefix("$")
            if not TICKER.fullmatch(ticker):
                raise ValueError("Invalid ticker")
            query = query.contains("cashtags", [ticker])
        response = (
            query.order("published_at", desc=True)
            .order("id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {
            "posts": response.data or [],
            "total": response.count or 0,
            "limit": limit,
            "offset": offset,
        }

    def ticker_heat(self, days=7, now=None):
        """Cashtag counts by source publication date for this window and the one before it."""
        now = now or datetime.now(timezone.utc)
        start, previous_start = now - timedelta(days=days), now - timedelta(days=2 * days)
        rows, offset = [], 0
        while offset < 10000:
            page = (
                self.db.table("x_posts")
                .select("author_username,published_at,cashtags")
                .gte("published_at", previous_start.isoformat())
                .lte("published_at", now.isoformat())
                .order("published_at", desc=True)
                .order("id", desc=True)
                .range(offset, offset + 999)
                .execute()
                .data
                or []
            )
            rows += page
            if len(page) < 1000:
                break
            offset += 1000
        heat = {}
        for row in rows:
            published = datetime.fromisoformat(row["published_at"].replace("Z", "+00:00"))
            for ticker in set(row.get("cashtags") or []):
                if not TICKER.fullmatch(ticker):
                    continue
                entry = heat.setdefault(
                    ticker,
                    {"ticker": ticker, "posts": 0, "previous": 0, "authors": set(), "latest": None},
                )
                if published >= start:
                    entry["posts"] += 1
                    entry["authors"].add(row["author_username"])
                    entry["latest"] = max(
                        entry["latest"] or row["published_at"], row["published_at"]
                    )
                else:
                    entry["previous"] += 1
        tickers = sorted(
            (
                {**entry, "authors": len(entry["authors"])}
                for entry in heat.values()
                if entry["posts"] > 0
            ),
            key=lambda entry: (-entry["posts"], -entry["authors"], entry["ticker"]),
        )
        return {"tickers": tickers, "days": days, "from": start.isoformat(), "to": now.isoformat()}

    def validate(self, payload):
        posts = normalize_import(payload)
        return {
            "total": len(posts),
            "authors": sorted({p["author_username"] for p in posts}),
            "tickers": sorted({t for p in posts for t in p["cashtags"]}),
            "truncated": sum(p["truncated"] for p in posts),
        }

    def upload(self, payload):
        posts = normalize_import(payload)
        # One transaction: creators and posts either both commit or both roll back.
        result = self.db.rpc("import_x_posts", {"posts": posts}).execute().data
        return {
            "total": len(posts),
            "inserted": result["inserted"],
            "skipped": len(posts) - result["inserted"],
        }


MAX_CRAWL_BATCH = 200
CRAWL_LIMITS = {"max_posts_per_creator": (1, 2000), "max_scrolls_per_creator": (1, 300)}


MEDIA_BUCKET = "x-post-media"  # same bucket as app.services.x_post_media.BUCKET
MEDIA_PATH = re.compile(r"[1-9][0-9]{0,24}/[0-9a-f]{64}\.[a-z0-9]{2,5}")


def _media_paths(post):
    """Storage paths of a post's archived media; only paths this importer itself writes."""
    paths = []
    for asset in post.get("media_assets") or []:
        url = asset.get("url") if isinstance(asset, dict) else None
        if not isinstance(url, str) or f"/{MEDIA_BUCKET}/" not in url:
            continue
        path = url.split(f"/{MEDIA_BUCKET}/", 1)[1].split("?", 1)[0]
        if MEDIA_PATH.fullmatch(path) and path.startswith(f"{post['id']}/"):
            paths.append(path)
    return paths


class CrawlTablesMissing(RuntimeError):
    """The x_crawler_settings migration has not been applied yet."""


def _crawl_tables(action):
    try:
        return action()
    except Exception as exc:
        # PostgREST "table not in schema cache": the migration is not applied.
        if "PGRST205" in str(exc):
            raise CrawlTablesMissing("X crawler settings tables are missing") from exc
        raise


class XCrawlerSettings:
    """Admin-managed crawl list and limits, read by the local X collector."""

    def __init__(self, db):
        self.db = db

    def get(self):
        def load():
            sources = (
                self.db.table("x_crawl_sources")
                .select("username,enabled,created_at,updated_at")
                .order("username")
                .execute()
                .data
                or []
            )
            rows = self.db.table("x_crawl_settings").select("*").eq("id", 1).limit(1).execute().data
            settings = rows[0] if rows else {}
            return {
                "sources": sources,
                "settings": {
                    key: settings.get(key, default)
                    for key, default in (
                        ("max_posts_per_creator", 500),
                        ("max_scrolls_per_creator", 60),
                    )
                },
                "updated_at": settings.get("updated_at"),
            }

        return _crawl_tables(load)

    def save_source(self, handle, enabled=True):
        if type(enabled) is not bool:
            raise ValueError("enabled must be boolean")
        handle = username(handle)
        row = {
            "username": handle,
            "enabled": enabled,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        return _crawl_tables(
            lambda: {
                "source": self.db.table("x_crawl_sources")
                .upsert(row, on_conflict="username")
                .execute()
                .data[0]
            }
        )

    def save_sources(self, handles):
        """Add or turn on many accounts at once. Validates every name before writing any."""
        if not isinstance(handles, list) or not 1 <= len(handles) <= MAX_CRAWL_BATCH:
            raise ValueError(f"Add 1 to {MAX_CRAWL_BATCH} accounts at a time")
        names = sorted({username(handle) for handle in handles})
        stamp = datetime.now(timezone.utc).isoformat()
        rows = [{"username": name, "enabled": True, "updated_at": stamp} for name in names]
        return _crawl_tables(
            lambda: {
                "sources": self.db.table("x_crawl_sources")
                .upsert(rows, on_conflict="username")
                .execute()
                .data
                or []
            }
        )

    def delete_creator(self, handle):
        """Remove a creator from the site and stop crawling them. Cannot be undone.

        Order makes a retry after any failure safe: crawling stops first, then media files,
        then posts (with their AI analysis), then the profile. The crawl row stays, turned
        off, so a name in the collector's local sources.json is not scanned again.
        """
        handle = username(handle)
        self.save_source(handle, False)
        posts, offset = [], 0
        while True:
            page = (
                self.db.table("x_posts")
                .select("id,media_assets")
                .eq("author_username", handle)
                .order("id")
                .range(offset, offset + 999)
                .execute()
                .data
                or []
            )
            posts += page
            if len(page) < 1000:
                break
            offset += 1000
        paths = [path for post in posts for path in _media_paths(post)]
        bucket = self.db.storage.from_(MEDIA_BUCKET)
        for start in range(0, len(paths), 100):
            bucket.remove(paths[start : start + 100])
        if posts:
            self.db.table("x_posts").delete().eq("author_username", handle).execute()
        self.db.table("x_creators").delete().eq("username", handle).execute()
        return {"username": handle, "posts": len(posts), "media": len(paths)}

    def disabled(self):
        """Names an administrator turned off; their posts must not be imported."""
        try:
            sources = self.get()["sources"]
        except CrawlTablesMissing:
            return set()
        return {row["username"] for row in sources if row["enabled"] is False}

    def save_settings(self, values):
        row = {"id": 1, "updated_at": datetime.now(timezone.utc).isoformat()}
        for key, (low, high) in CRAWL_LIMITS.items():
            value = values.get(key)
            if type(value) is not int or not low <= value <= high:
                raise ValueError(f"{key} must be a whole number from {low} to {high}")
            row[key] = value
        return _crawl_tables(
            lambda: {
                "settings": self.db.table("x_crawl_settings")
                .upsert(row, on_conflict="id")
                .execute()
                .data[0]
            }
        )
