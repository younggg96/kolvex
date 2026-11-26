#!/usr/bin/env python3
"""Run public X collection with local Playwright, then commit validated exports."""

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
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import sync

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
LABEL = "app.kolvex.x-posts"
DAEMON_LABEL = "app.kolvex.x-posts.browser"


def deploy_runtime():
    """Keep launchd's runtime outside macOS's protected Documents directory."""
    runtime = Path.home() / "Library" / "Application Support" / "Kolvex" / "x-worker"
    destination = runtime / "side-projects" / "x-posts"
    if ROOT == destination:
        return destination
    runtime.mkdir(parents=True, exist_ok=True, mode=0o700)
    runtime.chmod(0o700)
    destination.mkdir(parents=True, exist_ok=True)
    with workflow_lock(destination):
        files = (
            "workflow.py",
            "sync.py",
            "browser.mjs",
            "collect-in-cua.mjs",
            "extract-posts.js",
            "run.sh",
            "package.json",
            "package-lock.json",
            "COLLECTOR.md",
            "README.md",
        )
        for name in files:
            shutil.copy2(ROOT / name, destination / name)
        # Seed public data once. Never copy the browser profile or its credentials.
        if not (destination / "sources.json").exists():
            shutil.copy2(ROOT / "sources.json", destination / "sources.json")
            if (ROOT / "data").exists():
                shutil.copytree(ROOT / "data", destination / "data", dirs_exist_ok=True)
            (destination / "state").mkdir(exist_ok=True)
            for path in (ROOT / "state").glob("*.json"):
                shutil.copy2(path, destination / "state" / path.name)
        backend = runtime / "kolvex-backend-py"
        services = backend / "app" / "services"
        services.mkdir(parents=True, exist_ok=True)
        for name in ("x_content.py", "x_post_analysis.py", "x_post_media.py"):
            shutil.copy2(sync.BACKEND / "app" / "services" / name, services / name)
        from dotenv import dotenv_values

        values = dotenv_values(sync.BACKEND / ".env")
        credentials = {
            key: os.environ.get(key) or values.get(key)
            for key in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "DEEPSEEK_API_KEY")
        }
        if not (credentials["SUPABASE_URL"] and credentials["SUPABASE_SERVICE_KEY"]):
            raise RuntimeError("Backend Supabase configuration is required before installation.")
        if not credentials["DEEPSEEK_API_KEY"]:
            print("未配置 DEEPSEEK_API_KEY：帖子照常入库，逐帖分析留在队列中待后续处理。")
        credentials = {key: value for key, value in credentials.items() if value}
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
        dependencies = [
            f"{package}=={importlib.metadata.version(package)}"
            for package in ("supabase", "python-dotenv", "httpx")
        ]
        subprocess.run(
            [str(python), "-m", "pip", "install", "--disable-pip-version-check", *dependencies],
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


DEFAULT_INTERVAL_MINUTES = 120
BROWSER_MODES = ("dedicated", "daily")


def browser_mode(root=ROOT):
    """dedicated: Playwright's own Chrome profile; daily: attach to the user's running Chrome."""
    mode = (sync.read_json(root / "state" / "browser.json", {}) or {}).get("mode")
    return mode if mode in BROWSER_MODES else "dedicated"


def set_browser_mode(root, mode):
    sync.atomic_json(root / "state" / "browser.json", {"mode": mode})


def browser_env(root=ROOT):
    return {**os.environ, "KOLVEX_X_BROWSER": browser_mode(root)}


def load_agent(path, config, target):
    """Write a LaunchAgent and (re)load it."""
    label = config["Label"]
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_bytes(plistlib.dumps(config))
    temporary.chmod(0o600)
    temporary.replace(path)
    subprocess.run(
        ["launchctl", "bootout", f"{target}/{label}"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # bootout returns before a slow-exiting job is gone; bootstrapping then fails with error 5.
    for _ in range(40):
        loaded = subprocess.run(
            ["launchctl", "print", f"{target}/{label}"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if loaded.returncode != 0:
            break
        time.sleep(0.25)
    # A label left disabled (e.g. by an earlier `launchctl disable`) also fails with error 5.
    subprocess.run(["launchctl", "enable", f"{target}/{label}"], check=True)
    subprocess.run(["launchctl", "bootstrap", target, str(path)], check=True)


def schedule(action, interval_minutes=DEFAULT_INTERVAL_MINUTES, browser=None):
    if sys.platform != "darwin":
        raise RuntimeError("The built-in scheduler requires macOS launchd.")
    agents = Path.home() / "Library" / "LaunchAgents"
    path = agents / f"{LABEL}.plist"
    daemon_path = agents / f"{DAEMON_LABEL}.plist"
    target = f"gui/{os.getuid()}"
    if action == "schedule-status":
        code = subprocess.call(["launchctl", "print", f"{target}/{LABEL}"])
        if daemon_path.exists():
            subprocess.call(["launchctl", "print", f"{target}/{DAEMON_LABEL}"])
        return code
    if action in ("pause", "uninstall"):
        for label, agent in ((LABEL, path), (DAEMON_LABEL, daemon_path)):
            subprocess.run(["launchctl", "bootout", f"{target}/{label}"], check=False)
            if action == "uninstall":
                agent.unlink(missing_ok=True)
        print("已停用本地 X 定时采集（含日常 Chrome 常驻连接）。")
        return 0
    runtime_root = deploy_runtime()
    if browser:
        set_browser_mode(runtime_root, browser)
    log_dir = runtime_root / "state"
    log_dir.mkdir(parents=True, exist_ok=True)
    environment = {
        "PATH": os.environ.get("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"),
        "NODE_BIN": node_binary(),
    }
    daily = browser_mode(runtime_root) == "daily"
    if daily:
        # Holds one approved Chrome connection so scheduled runs need no new approval.
        load_agent(
            daemon_path,
            {
                "Label": DAEMON_LABEL,
                "ProgramArguments": [node_binary(), str(runtime_root / "browser.mjs"), "serve"],
                "WorkingDirectory": str(runtime_root),
                "RunAtLoad": True,
                "KeepAlive": True,
                "ThrottleInterval": 60,
                "ProcessType": "Interactive",
                "EnvironmentVariables": environment,
                "StandardOutPath": str(log_dir / "browser-daemon.log"),
                "StandardErrorPath": str(log_dir / "browser-daemon.log"),
            },
            target,
        )
    else:
        subprocess.run(
            ["launchctl", "bootout", f"{target}/{DAEMON_LABEL}"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        daemon_path.unlink(missing_ok=True)
    load_agent(
        path,
        {
            "Label": LABEL,
            "ProgramArguments": ["/bin/bash", str(runtime_root / "run.sh"), "run"],
            "WorkingDirectory": str(runtime_root.parents[1]),
            "StartInterval": interval_minutes * 60,
            "RunAtLoad": False,
            "ProcessType": "Background",
            "EnvironmentVariables": environment,
            "StandardOutPath": str(log_dir / "scheduler.log"),
            "StandardErrorPath": str(log_dir / "scheduler-error.log"),
        },
        target,
    )
    label = "日常 Chrome · 常驻连接" if daily else "专用 Chrome"
    print(f"已启用本地 X 定时采集（Playwright · {label}），每 {interval_minutes} 分钟执行一次。")
    if daily:
        print("常驻连接进程正在连接日常 Chrome，请在 Chrome 弹出的确认框里点允许。")
    return 0


def node_binary():
    binary = os.environ.get("NODE_BIN") or shutil.which("node")
    if not binary:
        raise RuntimeError("Node.js is required. Put node on PATH or set NODE_BIN.")
    return binary


@contextmanager
def workflow_lock(root):
    (root / "state").mkdir(parents=True, exist_ok=True)
    with (root / "state" / ".workflow.lock").open("a") as file:
        fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def collect(directory, timeout, root=ROOT):
    """Launch the deterministic browser collector without a model."""
    command = [node_binary(), str(root / "browser.mjs"), "collect", str(directory)]
    log_path = directory / "browser.log"
    with log_path.open("w") as log:
        os.chmod(log_path, 0o600)
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            env=browser_env(root),
            stdout=log,
            stderr=log,
            text=True,
            start_new_session=True,
        )
        try:
            process.wait(timeout=timeout)
            return process.returncode
        except (subprocess.TimeoutExpired, KeyboardInterrupt) as error:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            if isinstance(error, KeyboardInterrupt):
                raise
            return 124


def source_results(directory, plan):
    results = []
    for source in plan["sources"]:
        handle = source["username"]
        summary = sync.read_json(directory / f"{handle}-summary.json")
        if not summary:
            summary = {"handle": handle, "complete": False, "reason": "collection_interrupted"}
        results.append(summary)
    return results


DEFAULT_TIMEOUT_SECONDS = 5400  # 90 min; a 2-hour schedule leaves room before the next run.


def run_once(timeout=DEFAULT_TIMEOUT_SECONDS, root=ROOT):
    node_binary()
    with workflow_lock(root):
        incoming = root / "data" / "incoming"
        incoming.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        directory = incoming / f"workflow-{stamp}-{uuid.uuid4().hex[:8]}"
        directory.mkdir()
        result = {"directory": str(directory), "started_at": sync.now(), "status": "preparing"}
        status_path = root / "state" / "workflow.json"
        sync.atomic_json(status_path, result)
        interrupted = False
        inserted = 0
        try:
            service = sync.XContentService(sync.database())
            with sync.locked(root):
                # Recover exports saved before a previous process reached finish.
                for old_plan in sorted(incoming.glob("*/plan.json")):
                    recovery = sync.finish_run(root, old_plan.parent, service)
                    inserted += sum(file["inserted"] for file in recovery["files"])
                plan = sync.prepare(root, service)
                inserted += plan["retried"]
                sync.atomic_json(directory / "plan.json", plan)
            result["status"] = "collecting"
            sync.atomic_json(status_path, result)
            try:
                result["collector_exit_code"] = collect(directory, timeout, root)
            except KeyboardInterrupt:
                interrupted = True
                result["collector_exit_code"] = 130
            except OSError:
                result["collector_exit_code"] = 127
            # A failed collector may still have produced valid complete exports.
            with sync.locked(root):
                committed = sync.finish_run(root, directory, service)
            inserted += sum(file["inserted"] for file in committed["files"])
            result.update(inserted=inserted, files=committed["files"])
            # Runs even without new posts so earlier queued analysis/media get retried.
            result.update(sync.post_process(root, service))
            result["sources"] = source_results(directory, plan)
            result["status"] = (
                "complete"
                if (
                    result["collector_exit_code"] == 0
                    and all(source["complete"] for source in result["sources"])
                )
                else "partial"
            )
        except Exception as error:
            # Provider errors may contain credentials. Persist only the error class.
            result.update(status="failed", error=type(error).__name__, inserted=inserted)
        result["finished_at"] = sync.now()
        sync.atomic_json(directory / "workflow-result.json", result)
        sync.atomic_json(status_path, result)
        if interrupted:
            raise KeyboardInterrupt
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("run", "watch"):
        command = commands.add_parser(name)
        command.add_argument(
            "--timeout",
            type=int,
            default=DEFAULT_TIMEOUT_SECONDS,
            help="Collector timeout in seconds",
        )
    commands.choices["watch"].add_argument("--hours", type=float, default=0.5)
    commands.add_parser("status")
    for name in ("install", "pause", "uninstall", "schedule-status", "login"):
        commands.add_parser(name)
    commands.choices["install"].add_argument(
        "--interval-minutes",
        type=int,
        default=DEFAULT_INTERVAL_MINUTES,
        help="Minutes between scheduled runs (minimum 30)",
    )
    commands.choices["install"].add_argument(
        "--browser",
        choices=BROWSER_MODES,
        help="dedicated: separate Chrome profile; daily: your running Chrome (kept if omitted)",
    )
    add = commands.add_parser("add")
    add.add_argument("profiles", nargs="+")
    args = parser.parse_args()
    if args.command == "install":
        if args.interval_minutes < 30:
            parser.error("Interval must be at least 30 minutes to stay gentle on X")
        return schedule("install", args.interval_minutes, args.browser)
    if args.command in ("pause", "uninstall", "schedule-status"):
        return schedule(args.command)
    if args.command == "login":
        with workflow_lock(ROOT):
            code = subprocess.call(
                [node_binary(), str(ROOT / "browser.mjs"), "login"], env=browser_env(ROOT)
            )
        if code:
            sync.atomic_json(
                ROOT / "state" / "workflow.json",
                {
                    "status": "login_required",
                    "reason": "login_incomplete",
                    "finished_at": sync.now(),
                },
            )
            return code
        agent = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
        if agent.exists():
            # Keep the interval the user chose at install time.
            seconds = plistlib.loads(agent.read_bytes()).get("StartInterval")
            schedule("install", seconds // 60 if seconds else DEFAULT_INTERVAL_MINUTES)
        result = run_once()
        print(json.dumps(result, ensure_ascii=False), flush=True)
        return 0 if result["status"] == "complete" else 1
    if args.command == "status":
        print(
            json.dumps(
                sync.read_json(ROOT / "state" / "workflow.json", {"status": "never_run"}),
                ensure_ascii=False,
            )
        )
        return 0
    if args.command == "add":
        with sync.locked(ROOT):
            print(json.dumps(sync.add_sources(ROOT, args.profiles), ensure_ascii=False))
        return 0
    if args.timeout <= 0 or (args.command == "watch" and args.hours <= 0):
        parser.error("Timeout and interval must be positive")
    while True:
        started = time.monotonic()
        try:
            result = run_once(args.timeout)
        except BlockingIOError:
            result = {"status": "busy"}
        except RuntimeError as error:
            print(str(error))
            return 1
        print(json.dumps(result, ensure_ascii=False), flush=True)
        if args.command == "run":
            return 0 if result["status"] == "complete" else 1
        time.sleep(max(0, args.hours * 3600 - (time.monotonic() - started)))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
