#!/usr/bin/env python3
"""Persist browser exports and sync them through Kolvex's validated atomic importer."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import sys
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parents[1] / "kolvex-backend-py"
sys.path.insert(0, str(BACKEND))
from app.services.x_content import CrawlTablesMissing, XContentService, XCrawlerSettings, normalize_import, username


def now():
    return datetime.now(timezone.utc).isoformat()


def read_json(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".x-sync-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as output:
            json.dump(value, output, ensure_ascii=False, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextmanager
def locked(root):
    (root / "state").mkdir(parents=True, exist_ok=True)
    with (root / "state" / ".sync.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def state_for(root, handle):
    path = root / "state" / f"{handle}.json"
    if path.exists():
        return read_json(path)
    # The original manual export used mixed-case filenames.
    for candidate in (root / "state").glob("*.json"):
        if candidate.stem.lower() == handle:
            return read_json(candidate)
    return {"username": handle}


def database():
    from dotenv import load_dotenv
    from supabase import create_client
    from supabase.client import ClientOptions
    load_dotenv(BACKEND / ".env")
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Backend SUPABASE_URL and SUPABASE_SERVICE_KEY are required")
    return create_client(url, key, options=ClientOptions(auto_refresh_token=False, persist_session=False))


def plan(root, service=None):
    config = read_json(root / "sources.json")
    handles = {username(value) for value in config["usernames"]}
    max_posts = config.get("max_posts_per_creator", 500)
    max_scrolls = config.get("max_scrolls_per_creator", 60)
    if config.get("include_database_creators"):
        if service is None:
            raise RuntimeError("Database creator lookup is required; cannot silently use a stale local list")
        try:
            admin = XCrawlerSettings(service.db).get()
        except CrawlTablesMissing:
            # Migration not applied yet: keep the original list (local + every known creator).
            handles.update(username(row["username"]) for row in service.creators()["creators"])
        else:
            # The admin list decides. Local names it has never seen are still scanned;
            # names an administrator disabled or that are listed as disabled are skipped.
            known = {username(row["username"]): row["enabled"] for row in admin["sources"]}
            handles = {h for h, enabled in known.items() if enabled} | {h for h in handles if h not in known}
            max_posts = admin["settings"]["max_posts_per_creator"]
            max_scrolls = admin["settings"]["max_scrolls_per_creator"]
    result = []
    for handle in sorted(handles):
        state = state_for(root, handle)
        stop_ids = state.get("boundary_ids", state.get("seen_post_ids", []))
        result.append({"username": handle, "url": f"https://x.com/{handle}", "stop_ids": stop_ids,
                       "max_posts": max_posts, "max_scrolls": max_scrolls})
    return {"sources": result}


def add_sources(root, profiles):
    handles = set()
    for profile in profiles:
        value = profile.strip()
        if "://" in value:
            url = urlsplit(value)
            parts = url.path.strip("/").split("/")
            if url.scheme != "https" or url.netloc.lower() not in ("x.com", "www.x.com") or len(parts) != 1:
                raise ValueError("Use an X username or an https://x.com/<username> profile URL")
            value = parts[0]
        handles.add(username(value))
    path = root / "sources.json"
    config = read_json(path)
    existing = {username(value) for value in config["usernames"]}
    added = sorted(handles - existing)
    if added:
        config["usernames"].extend(added)
        atomic_json(path, config)
    return {"added": added, "already_tracked_locally": sorted(handles & existing)}


def ingest(root, payload):
    if not isinstance(payload, dict):
        raise ValueError("Collector must provide an export object with posts and scan metadata")
    posts = normalize_import(payload)
    authors = {row["author_username"] for row in posts}
    if len(authors) != 1:
        raise ValueError("Each collector export must contain one creator")
    handle = next(iter(authors))
    if any(post["truncated"] for post in posts):
        raise ValueError("Expand long posts before ingesting; incomplete text must not become an immutable saved post")
    if payload.get("scan_complete") is not True:
        complete = False
    else:
        complete = True
    if complete and payload.get("stop_reason") not in ("checkpoint", "end_of_timeline", "initial_window"):
        raise ValueError("Complete scans require an explicit safe stop reason")
    state = state_for(root, handle)
    boundary = set(state.get("boundary_ids", state.get("seen_post_ids", [])))
    if complete and payload.get("stop_reason") == "initial_window" and boundary:
        raise ValueError("An existing checkpoint requires scanning back to it")
    if complete and payload.get("stop_reason") == "checkpoint" and not boundary.intersection(p["id"] for p in posts if not p["pinned"]):
        raise ValueError("The previous checkpoint must be present in the captured posts")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    path = root / "data" / f"{handle}-{stamp}.json"
    atomic_json(path, {**payload, "schema": "kolvex-x-browser-export/1.0", "collected_at": payload.get("collected_at", now()),
                       "posts": posts, "post_count": len(posts), "scan_complete": complete})
    # Observation alone never advances a checkpoint. sync_file does so after commit.
    return {"file": str(path), "posts": len(posts), "scan_complete": complete}


def sync_file(root, path, service, disabled=frozenset()):
    payload = read_json(path)
    posts = normalize_import(payload)
    if any(post["truncated"] for post in posts):
        raise ValueError("Expand long posts before syncing")
    handle_set = {p["author_username"] for p in posts}
    if len(handle_set) != 1:
        raise ValueError("Expected one creator per saved export")
    handle = next(iter(handle_set))
    if handle in disabled:
        # Turned off or deleted by an administrator: never (re-)import. The file stays,
        # so the posts are uploaded if the account is turned back on.
        return {"file": path.name, "inserted": 0, "skipped": len(posts), "pending": 0, "disabled": True}
    state = state_for(root, handle)
    synced = set(state.get("synced_post_ids", []))
    pending = [post for post in posts if post["id"] not in synced]
    result = service.upload(pending) if pending else {"inserted": 0, "skipped": 0}
    # If DB commit succeeds and checkpoint writing fails, retry is safe by post ID.
    synced.update(post["id"] for post in posts)
    state.update({"username": handle, "synced_post_ids": sorted(synced, key=int, reverse=True), "last_synced_at": now()})
    complete = isinstance(payload, dict) and payload.get("scan_complete") is True
    if complete:
        if any(post["truncated"] for post in posts):
            raise ValueError("Incomplete long posts were saved but cannot advance the scan checkpoint")
        previous = int(state.get("last_collected_post_id", "0"))
        latest = max(int(post["id"]) for post in posts if not post["pinned"]) if any(not p["pinned"] for p in posts) else 0
        if latest >= previous:
            state.update({"boundary_ids": [post["id"] for post in posts if not post["pinned"]],
                          "last_collected_post_id": str(latest), "collected_at": payload.get("collected_at")})
    atomic_json(root / "state" / f"{handle}.json", state)
    return {"file": path.name, "inserted": result["inserted"], "skipped": result["skipped"], "pending": len(pending)}


def sync_saved(root, service):
    disabled = XCrawlerSettings(service.db).disabled()
    return [sync_file(root, path, service, disabled) for path in sorted((root / "data").glob("*.json"))]


def prepare(root, service):
    retried = sync_saved(root, service)
    result = plan(root, service)
    return {**result, "retried": sum(file["inserted"] for file in retried)}


def finish_run(root, directory, service):
    if not (directory / "plan.json").is_file():
        raise ValueError("Provide a collection directory created by prepare")
    saved_paths = []
    for path in sorted(directory.glob("*-export.json")):
        payload = read_json(path)
        posts = normalize_import(payload)
        handle = posts[0]["author_username"]
        state = state_for(root, handle)
        synced = set(state.get("synced_post_ids", []))
        ids = {post["id"] for post in posts if not post["pinned"]}
        # A complete scan of already-imported posts still has to move the checkpoint forward,
        # unless a newer scan already moved it past this export (an old run directory).
        stale = max(map(int, ids), default=0) < int(state.get("last_collected_post_id", "0"))
        new_boundary = (
            payload.get("scan_complete") is True
            and not stale
            and set(state.get("boundary_ids", [])) != ids
        )
        if not new_boundary and all(
            post["author_username"] == handle and post["id"] in synced for post in posts
        ):
            continue
        saved_paths.append(Path(ingest(root, payload)["file"]))
    disabled = XCrawlerSettings(service.db).disabled() if saved_paths else set()
    return {"files": [sync_file(root, path, service, disabled) for path in saved_paths]}


def fill_profiles(directory, service):
    """Fill empty creator avatars, names and bios from this run's profile headers.

    Best effort: a failure is reported by error class and never blocks committed posts.
    """
    disabled = XCrawlerSettings(service.db).disabled()
    filled, errors = {}, []
    for path in sorted(directory.glob("*-profile.json")):
        profile = read_json(path)
        try:
            if username(profile.get("username", "")) in disabled:
                continue
            fields = service.fill_profile(profile)
        except Exception as error:
            errors.append(type(error).__name__)
            continue
        if fields:
            filled[profile["username"]] = fields
    return {"filled": filled, "errors": errors}


def post_process(root, service):
    """Analyze queued posts and archive media after commit; each step retries next run."""
    from app.services.x_post_analysis import analyze_pending
    from app.services.x_post_media import archive_media

    result = {}
    steps = (
        ("analysis", lambda: analyze_pending(service.db, os.getenv("DEEPSEEK_API_KEY"))),
        ("media", lambda: archive_media(service.db, root / "data" / "incoming")),
    )
    for name, step in steps:
        try:
            result[name] = step()
        except Exception as error:
            # Committed posts stay readable; only the error class is kept to avoid leaking keys.
            result[name] = {"error": type(error).__name__}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("plan")
    start = commands.add_parser("prepare", help="Retry saved batches and write a new browser run plan")
    start.add_argument("directory", type=Path)
    finish = commands.add_parser("finish", help="Sync posts, archive media and analyze committed posts")
    finish.add_argument("directory", type=Path)
    add = commands.add_parser("add", help="Track X profiles on this machine")
    add.add_argument("profiles", nargs="+")
    collect = commands.add_parser("ingest")
    collect.add_argument("file", type=Path)
    sync = commands.add_parser("sync")
    sync.add_argument("--file", type=Path)
    args = parser.parse_args()
    try:
        with locked(ROOT):
            if args.command == "ingest":
                result = ingest(ROOT, read_json(args.file))
            elif args.command == "add":
                result = add_sources(ROOT, args.profiles)
            else:
                service = XContentService(database())
                if args.command == "plan":
                    result = plan(ROOT, service)
                elif args.command == "prepare":
                    args.directory.mkdir(parents=True, exist_ok=False)
                    result = prepare(ROOT, service)
                    atomic_json(args.directory / "plan.json", result)
                elif args.command == "finish":
                    result = finish_run(ROOT, args.directory, service)
                    result.update(post_process(ROOT, service))
                else:
                    files = [sync_file(ROOT, args.file.resolve(), service)] if args.file else sync_saved(ROOT, service)
                    result = {"files": files}
            print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        # Do not print database URLs, headers, credentials or raw provider errors.
        print(json.dumps({"error": type(exc).__name__, "message": str(exc) if isinstance(exc, (ValueError, RuntimeError)) else "Sync failed; keep saved exports and retry. Check database access and schema."}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
