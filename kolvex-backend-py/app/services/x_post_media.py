"""Archive observed public X attachments without forwarding browser or database credentials."""

import hashlib
import json
import re
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

import httpx

BUCKET = "x-post-media"
KINDS = {"image", "video", "video_poster"}
IMAGE_LIMIT = 10 * 1024 * 1024
VIDEO_LIMIT = 40 * 1024 * 1024
FORMATS = {
    "image/jpeg": ("jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": ("png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": ("webp", lambda data: data[:4] == b"RIFF" and data[8:12] == b"WEBP"),
    "image/gif": ("gif", lambda data: data[:6] in (b"GIF87a", b"GIF89a")),
    "video/mp4": ("mp4", lambda data: data[4:8] == b"ftyp"),
}


class UnavailableMedia(Exception):
    """An attachment which cannot be archived under the public file contract."""


def normalize_source(candidate, handle, post_id):
    if not isinstance(candidate, dict):
        return None
    kind = candidate.get("kind")
    raw_url = candidate.get("url")
    source = candidate.get("source_url")
    if (
        not isinstance(kind, str)
        or kind not in KINDS
        or not isinstance(raw_url, str)
        or len(raw_url) > 2048
        or not isinstance(source, str)
        or not isinstance(handle, str)
        or not re.fullmatch(r"[a-z0-9_]{1,15}", handle)
        or not isinstance(post_id, str)
        or not re.fullmatch(r"[1-9][0-9]{0,24}", post_id)
    ):
        return None
    slot = "photo" if kind == "image" else "video"
    if not re.fullmatch(
        rf"https://x\.com/{handle}/status/{post_id}/{slot}/[1-9][0-9]?", source, re.I
    ):
        return None
    try:
        url = urlsplit(raw_url)
    except ValueError:
        return None
    if url.scheme != "https" or url.fragment:
        return None
    if kind == "video":
        if url.netloc != "video.twimg.com" or not re.fullmatch(r"/[A-Za-z0-9_./-]+\.mp4", url.path):
            return None
        tag = parse_qs(url.query).get("tag", [""])[0]
        url = url._replace(query=urlencode({"tag": tag}) if re.fullmatch(r"\d{1,3}", tag) else "")
    else:
        image_path = (
            r"/media/[A-Za-z0-9_-]+(?:\.(?:jpg|jpeg|png|gif|webp))?"
            if kind == "image"
            else r"/(?:ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)/[A-Za-z0-9_./-]+"
        )
        if url.netloc != "pbs.twimg.com" or not re.fullmatch(image_path, url.path):
            return None
        if kind == "image":
            query = parse_qs(url.query)
            image_format = query.get("format", [""])[0]
            params = {"name": "large"}
            if image_format in {"jpg", "jpeg", "png", "gif", "webp"}:
                params["format"] = image_format
            url = url._replace(query=urlencode(params))
        else:
            url = url._replace(query="")
    if ".." in url.path.split("/"):
        return None
    url = urlunsplit(url)
    source = source.lower()
    key = hashlib.sha256(f"{source}\n{kind}\n{url}".encode()).hexdigest()
    alt = candidate.get("alt")
    return {
        "key": key,
        "kind": kind,
        "url": url,
        "source_url": source,
        "alt": alt.strip()[:1000] if isinstance(alt, str) else "",
    }


def fetch_media(client, source):
    video = source["kind"] == "video"
    limit = VIDEO_LIMIT if video else IMAGE_LIMIT
    with client.stream("GET", source["url"], headers={"Accept-Encoding": "identity"}) as response:
        if response.is_redirect or response.status_code in {403, 404, 410}:
            raise UnavailableMedia
        response.raise_for_status()
        mime = response.headers.get("content-type", "").partition(";")[0].strip().lower()
        if mime not in FORMATS or (mime == "video/mp4") != video:
            raise UnavailableMedia
        length = response.headers.get("content-length", "")
        if length.isdecimal() and int(length) > limit:
            raise UnavailableMedia
        content = bytearray()
        for chunk in response.iter_bytes(chunk_size=65536):
            if len(content) + len(chunk) > limit:
                raise UnavailableMedia
            content.extend(chunk)
    extension, matches = FORMATS[mime]
    if not matches(content):
        raise UnavailableMedia
    return bytes(content), mime, extension


def read_staged_media(directory, post_id, source):
    """Reuse files saved with a recovery manifest, validating them before upload."""
    video = source["kind"] == "video"
    limit = VIDEO_LIMIT if video else IMAGE_LIMIT
    for mime, (extension, matches) in FORMATS.items():
        if (mime == "video/mp4") != video:
            continue
        path = directory / "attachments" / post_id / f"{source['key']}.{extension}"
        try:
            with path.open("rb") as file:
                content = file.read(limit + 1)
        except FileNotFoundError:
            continue
        if len(content) <= limit and matches(content):
            return content, mime, extension
    return None


def archive_media(db, incoming):
    """Retry saved manifests, skipping DB-confirmed assets and retaining transient failures."""
    result = {
        "archived": 0,
        "images": 0,
        "videos": 0,
        "video_posters": 0,
        "unavailable": 0,
        "pending_manifests": 0,
    }
    bucket = db.storage.from_(BUCKET)
    with httpx.Client(timeout=30, follow_redirects=False, trust_env=False) as client:
        for manifest in sorted(incoming.glob("*/*-media.json")):
            done = manifest.with_suffix(".done")
            if done.exists():
                continue
            try:
                complete = archive_manifest(db, bucket, client, manifest, result)
                if complete:
                    done.touch(exist_ok=True)
                else:
                    result["pending_manifests"] += 1
            except Exception:
                # A local file or provider error can contain sensitive paths or headers.
                result["pending_manifests"] += 1
                result["error"] = "media_archive_failed"
    return result


def archive_manifest(db, bucket, client, manifest, result):
    payload = json.loads(manifest.read_text())
    handle = payload["handle"]
    candidates = {}
    for post in payload["posts"]:
        post_id = post["id"]
        for raw in post["media_sources"]:
            source = normalize_source(raw, handle, post_id)
            if source:
                candidates.setdefault(post_id, {})[source["key"]] = source
    if not candidates:
        return True

    complete = True
    post_ids = list(candidates)
    for start in range(0, len(post_ids), 50):
        rows = (
            db.table("x_posts")
            .select("id,media_assets")
            .eq("author_username", handle)
            .eq("truncated", False)
            .in_("id", post_ids[start : start + 50])
            .execute()
            .data
            or []
        )
        complete &= len(rows) == len(post_ids[start : start + 50])
        for row in rows:
            saved = {asset["key"] for asset in row["media_assets"]}
            for key, source in candidates[row["id"]].items():
                if key in saved:
                    continue
                try:
                    local = read_staged_media(manifest.parent, row["id"], source)
                    content, mime, extension = local or fetch_media(client, source)
                except UnavailableMedia:
                    result["unavailable"] += 1
                    continue
                except httpx.HTTPError:
                    complete = False
                    continue
                path = f"{row['id']}/{key}.{extension}"
                bucket.upload(
                    path,
                    content,
                    {"content-type": mime, "cache-control": "31536000", "upsert": "true"},
                )
                asset = {**source, "url": bucket.get_public_url(path)}
                db.rpc("record_x_post_media", {"post_id": row["id"], "asset": asset}).execute()
                result["archived"] += 1
                result[
                    {"image": "images", "video": "videos", "video_poster": "video_posters"}[
                        source["kind"]
                    ]
                ] += 1
    return complete
