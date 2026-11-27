#!/usr/bin/env python3
"""Daily Xiaohongshu sentiment: local Playwright collection → DeepSeek digest → validated upsert.

launchd wakes this every hour; a run only proceeds once per Pacific day, after RUN_AFTER_HOUR,
so the schedule survives sleep, time zones and DST. A captcha or login wall ends the day:
it is never retried automatically and never bypassed.
"""

import argparse
import fcntl
import importlib.metadata
import json
import os
import plistlib
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parents[1] / "kolvex-backend-py"
sys.path.insert(0, str(BACKEND))

import digest  # noqa: E402

LABEL = "app.kolvex.xhs-daily"
LOS_ANGELES = ZoneInfo("America/Los_Angeles")
RUN_AFTER_HOUR = 19  # Pacific time; matches the manual digest's evening capture.
MAX_ATTEMPTS_PER_DAY = 2
STOP_FOR_DAY = {"login_required", "blocked"}
COLLECT_TIMEOUT_SECONDS = 1800
TABLE = "xhs_daily_sentiment"


def now():
    return datetime.now(timezone.utc).isoformat()


def read_json(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".xhs-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as output:
            json.dump(value, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextmanager
def workflow_lock(root):
    (root / "state").mkdir(parents=True, exist_ok=True)
    with (root / "state" / ".workflow.lock").open("a") as file:
        fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def load_env():
    from dotenv import load_dotenv

    load_dotenv(BACKEND / ".env")


def database():
    from supabase import create_client
    from supabase.client import ClientOptions

    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Backend SUPABASE_URL and SUPABASE_SERVICE_KEY are required")
    return create_client(
        url, key, options=ClientOptions(auto_refresh_token=False, persist_session=False)
    )


def node_binary():
    binary = os.environ.get("NODE_BIN") or shutil.which("node")
    if not binary:
        raise RuntimeError("Node.js is required. Put node on PATH or set NODE_BIN.")
    return binary


def collector_options(root):
    """Optional overrides in config.json (keywords, scrollsPerKeyword, deepReads)."""
    config = read_json(root / "config.json", {}) or {}
    allowed = {"keywords", "scrollsPerKeyword", "deepReads", "commentsPerPost"}
    return {key: value for key, value in config.items() if key in allowed}


def should_run(day_state, today, hour, force):
    """Return None to proceed, or the reason this wake-up does nothing."""
    if force:
        return None
    if hour < RUN_AFTER_HOUR:
        return "before_run_hour"
    if day_state.get("date_pt") != today:
        return None
    if day_state.get("status") in ("complete", "manual_exists"):
        return "done_today"
    if day_state.get("status") in STOP_FOR_DAY:
        return "stopped_today"
    if day_state.get("attempts", 0) >= MAX_ATTEMPTS_PER_DAY:
        return "attempts_exhausted"
    return None


def manual_import_exists(db, date_pt):
    """An administrator's import for the day wins over the collector."""
    rows = db.table(TABLE).select("imported_by").eq("date_pt", date_pt).execute().data or []
    return bool(rows and rows[0].get("imported_by"))


def collect(root, directory, timeout=COLLECT_TIMEOUT_SECONDS):
    command = [
        node_binary(),
        str(root / "collect.mjs"),
        "collect",
        str(directory),
        json.dumps(collector_options(root), ensure_ascii=False),
    ]
    log_path = directory / "browser.log"
    with log_path.open("w") as log:
        os.chmod(log_path, 0o600)
        process = subprocess.Popen(
            command, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True
        )
        try:
            return process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            return 124


def run_once(root=ROOT, force=False, dry_run=False, no_ai=False, db=None, collector=None):
    """One gated attempt. Returns the result written to state/workflow.json."""
    pacific = datetime.now(LOS_ANGELES)
    today = pacific.date().isoformat()
    state_path = root / "state" / "day.json"
    day_state = read_json(state_path, {}) or {}
    skipped = should_run(day_state, today, pacific.hour, force)
    if skipped:
        return {"status": "skipped", "reason": skipped, "date_pt": today}

    with workflow_lock(root):
        load_env()
        attempts = (day_state.get("attempts", 0) if day_state.get("date_pt") == today else 0) + 1
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        directory = root / "data" / f"run-{stamp}-{uuid.uuid4().hex[:6]}"
        directory.mkdir(parents=True)
        result = {"date_pt": today, "started_at": now(), "directory": str(directory)}
        status_path = root / "state" / "workflow.json"
        try:
            write = not (dry_run or no_ai)
            if write:
                db = db or database()
                if manual_import_exists(db, today):
                    result["status"] = "manual_exists"
                    return result
            result["status"] = "collecting"
            atomic_json(status_path, result)
            result["collector_exit_code"] = (collector or collect)(root, directory)
            raw = read_json(directory / "raw.json")
            if not raw:
                result.update(status="failed", reason="no_raw_output")
                return result
            result.update(
                posts=len(raw.get("posts", [])),
                deep_reads=len(raw.get("deep_reads", [])),
                warnings=raw.get("warnings", []),
            )
            if raw.get("status") != "complete":
                result.update(status=raw.get("status", "failed"), reason=raw.get("reason"))
                return result
            if no_ai:
                result["status"] = "collected"
                return result
            result["status"] = "summarizing"
            atomic_json(status_path, result)
            day = digest.make_digest(raw, os.getenv("DEEPSEEK_API_KEY"))
            day = digest.validate(day, datetime.now(LOS_ANGELES).date())
            atomic_json(directory / "digest.json", day)
            result.update(date_pt=day["date_pt"], topics=len(day["topics"]))
            if not write:
                result["status"] = "dry_run"
                return result
            from app.services.xhs_sentiment_store import upsert_days

            # Re-check: an administrator may have imported while the run was collecting.
            if manual_import_exists(db, day["date_pt"]):
                result["status"] = "manual_exists"
                return result
            upsert_days(db, [day], None)
            result["status"] = "complete"
        except digest.DigestError as error:
            result.update(status="failed", reason=str(error))
        except Exception as error:
            # Provider and database errors may echo credentials: keep only the class name.
            result.update(status="failed", reason=type(error).__name__)
        finally:
            result["finished_at"] = now()
            atomic_json(directory / "workflow-result.json", result)
            atomic_json(status_path, result)
            if not (dry_run or no_ai):
                atomic_json(
                    state_path,
                    {"date_pt": today, "status": result["status"], "attempts": attempts},
                )
        return result


# ---------- install / launchd ----------

RUNTIME_FILES = (
    "workflow.py",
    "digest.py",
    "collect.mjs",
    "run.sh",
    "package.json",
    "package-lock.json",
    "README.md",
)
BACKEND_FILES = (
    "app/schemas/xhs_sentiment.py",
    "app/schemas/person_updates.py",
    "app/services/xhs_sentiment_store.py",
)


def deploy_runtime():
    """Copy the worker outside ~/Documents, which launchd jobs cannot read reliably."""
    runtime = Path.home() / "Library" / "Application Support" / "Kolvex" / "xhs-worker"
    destination = runtime / "side-projects" / "xhs-daily"
    if ROOT == destination:
        return destination
    runtime.mkdir(parents=True, exist_ok=True, mode=0o700)
    runtime.chmod(0o700)
    destination.mkdir(parents=True, exist_ok=True)
    with workflow_lock(destination):
        for name in RUNTIME_FILES:
            shutil.copy2(ROOT / name, destination / name)
        if (ROOT / "config.json").exists() and not (destination / "config.json").exists():
            shutil.copy2(ROOT / "config.json", destination / "config.json")
        backend = runtime / "kolvex-backend-py"
        for name in BACKEND_FILES:
            target = backend / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(BACKEND / name, target)
        from dotenv import dotenv_values

        values = dotenv_values(BACKEND / ".env")
        credentials = {
            key: os.environ.get(key) or values.get(key)
            for key in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "DEEPSEEK_API_KEY")
        }
        if not (credentials["SUPABASE_URL"] and credentials["SUPABASE_SERVICE_KEY"]):
            raise RuntimeError("Backend Supabase configuration is required before installation.")
        if not credentials["DEEPSEEK_API_KEY"]:
            raise RuntimeError("DEEPSEEK_API_KEY is required: the daily digest needs it.")
        env_path = backend / ".env"
        env_path.touch(mode=0o600, exist_ok=True)
        env_path.chmod(0o600)
        env_path.write_text(
            "".join(f"{key}={json.dumps(value)}\n" for key, value in credentials.items())
        )
        python = backend / "venv" / "bin" / "python"
        if not python.exists():
            subprocess.run(
                [os.path.realpath(sys.executable), "-m", "venv", str(backend / "venv")], check=True
            )
        packages = ("supabase", "python-dotenv", "httpx", "pydantic", "pydantic-core")
        subprocess.run(
            [
                str(python),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                *(f"{name}=={importlib.metadata.version(name)}" for name in packages),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        npm = shutil.which("npm")
        if not npm:
            raise RuntimeError("npm is required to install the browser runtime.")
        subprocess.run(
            [npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"],
            cwd=destination,
            check=True,
            stdout=subprocess.DEVNULL,
        )
        (destination / ".runtime-ready").touch(mode=0o600)
    return destination


def schedule(action):
    if sys.platform != "darwin":
        raise RuntimeError("The built-in scheduler requires macOS launchd.")
    path = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
    target = f"gui/{os.getuid()}"
    if action == "schedule-status":
        return subprocess.call(["launchctl", "print", f"{target}/{LABEL}"])
    if action in ("pause", "uninstall"):
        subprocess.run(["launchctl", "bootout", f"{target}/{LABEL}"], check=False)
        if action == "uninstall":
            path.unlink(missing_ok=True)
        print("已停用小红书每日定时采集。")
        return 0
    runtime_root = deploy_runtime()
    log_dir = runtime_root / "state"
    log_dir.mkdir(parents=True, exist_ok=True)
    config = {
        "Label": LABEL,
        "ProgramArguments": ["/bin/bash", str(runtime_root / "run.sh"), "run"],
        "WorkingDirectory": str(runtime_root.parents[1]),
        "StartInterval": 3600,
        "RunAtLoad": False,
        "ProcessType": "Background",
        "EnvironmentVariables": {
            "PATH": os.environ.get("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"),
            "NODE_BIN": node_binary(),
        },
        "StandardOutPath": str(log_dir / "scheduler.log"),
        "StandardErrorPath": str(log_dir / "scheduler-error.log"),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(plistlib.dumps(config))
    path.chmod(0o600)
    subprocess.run(
        ["launchctl", "bootout", f"{target}/{LABEL}"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(40):
        loaded = subprocess.run(
            ["launchctl", "print", f"{target}/{LABEL}"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if loaded.returncode != 0:
            break
        time.sleep(0.25)
    subprocess.run(["launchctl", "enable", f"{target}/{LABEL}"], check=True)
    subprocess.run(["launchctl", "bootstrap", target, str(path)], check=True)
    print(
        f"已启用小红书每日采集：每小时检查一次，太平洋时间 {RUN_AFTER_HOUR}:00 后每天采集一轮。"
        "首次使用请先运行 login 在专用 Chrome 里登录。"
    )
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run")
    run.add_argument("--force", action="store_true", help="Ignore the daily gate")
    run.add_argument("--dry-run", action="store_true", help="Build and validate, do not write")
    run.add_argument("--no-ai", action="store_true", help="Only collect raw.json")
    for name in ("status", "login", "install", "pause", "uninstall", "schedule-status"):
        commands.add_parser(name)
    args = parser.parse_args()
    if args.command in ("install", "pause", "uninstall", "schedule-status"):
        return schedule(args.command)
    if args.command == "status":
        print(
            json.dumps(
                read_json(ROOT / "state" / "workflow.json", {"status": "never_run"}),
                ensure_ascii=False,
            )
        )
        return 0
    if args.command == "login":
        with workflow_lock(ROOT):
            return subprocess.call([node_binary(), str(ROOT / "collect.mjs"), "login"])
    try:
        result = run_once(force=args.force, dry_run=args.dry_run, no_ai=args.no_ai)
    except BlockingIOError:
        result = {"status": "busy"}
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return (
        0
        if result["status"] in ("complete", "skipped", "dry_run", "collected", "manual_exists")
        else 1
    )


if __name__ == "__main__":
    raise SystemExit(main())
