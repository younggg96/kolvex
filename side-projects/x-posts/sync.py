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

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parents[1] / "kolvex-backend-py"
sys.path.insert(0, str(BACKEND))
from app.services.x_content import XContentService, normalize_import, username


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
    if config.get("include_database_creators"):
        if service is None:
            raise RuntimeError("Database creator lookup is required; cannot silently use a stale local list")
        handles.update(username(row["username"]) for row in service.creators()["creators"])
    result = []
    for handle in sorted(handles):
        state = state_for(root, handle)
        stop_ids = state.get("boundary_ids", state.get("seen_post_ids", []))
        result.append({"username": handle, "url": f"https://x.com/{handle}", "stop_ids": stop_ids,
                       "max_posts": config.get("max_posts_per_creator", 500),
                       "max_scrolls": config.get("max_scrolls_per_creator", 60)})
    return {"sources": result}


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


def sync_file(root, path, service):
    payload = read_json(path)
    posts = normalize_import(payload)
    if any(post["truncated"] for post in posts):
        raise ValueError("Expand long posts before syncing")
    handle_set = {p["author_username"] for p in posts}
    if len(handle_set) != 1:
        raise ValueError("Expected one creator per saved export")
    handle = next(iter(handle_set))
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("plan")
    collect = commands.add_parser("ingest")
    collect.add_argument("file", type=Path)
    sync = commands.add_parser("sync")
    sync.add_argument("--file", type=Path)
    args = parser.parse_args()
    try:
        with locked(ROOT):
            if args.command == "ingest":
                result = ingest(ROOT, read_json(args.file))
            else:
                service = XContentService(database())
                if args.command == "plan":
                    result = plan(ROOT, service)
                else:
                    paths = [args.file.resolve()] if args.file else sorted((ROOT / "data").glob("*.json"))
                    result = {"files": [sync_file(ROOT, path, service) for path in paths]}
            print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        # Do not print database URLs, headers, credentials or raw provider errors.
        print(json.dumps({"error": type(exc).__name__, "message": str(exc) if isinstance(exc, (ValueError, RuntimeError)) else "Sync failed; keep saved exports and retry. Check database access and schema."}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
