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
        shutil.copy2(sync.BACKEND / "app/services/x_content.py", services / "x_content.py")
        from dotenv import dotenv_values

        values = dotenv_values(sync.BACKEND / ".env")
        credentials = {
            key: os.environ.get(key) or values.get(key)
            for key in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY")
        }
        if not all(credentials.values()):
            raise RuntimeError("Backend Supabase configuration is required before installation.")
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
            for package in ("supabase", "python-dotenv")
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
        print("已停用本地 X 定时采集。")
        return 0
    runtime_root = deploy_runtime()
    log_dir = runtime_root / "state"
    log_dir.mkdir(parents=True, exist_ok=True)
    config = {
        "Label": LABEL,
        "ProgramArguments": ["/bin/bash", str(runtime_root / "run.sh"), "run"],
        "WorkingDirectory": str(runtime_root.parents[1]),
        "StartInterval": 1800,
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
    temporary = path.with_suffix(".tmp")
    temporary.write_bytes(plistlib.dumps(config))
    temporary.chmod(0o600)
    temporary.replace(path)
    subprocess.run(
        ["launchctl", "bootout", f"{target}/{LABEL}"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.run(["launchctl", "bootstrap", target, str(path)], check=True)
    print("已启用本地 X 定时采集，每 30 分钟执行一次。")
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


def run_once(timeout=1800, root=ROOT):
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
            "--timeout", type=int, default=1800, help="Collector timeout in seconds"
        )
    commands.choices["watch"].add_argument("--hours", type=float, default=0.5)
    commands.add_parser("status")
    for name in ("install", "pause", "uninstall", "schedule-status", "login"):
        commands.add_parser(name)
    add = commands.add_parser("add")
    add.add_argument("profiles", nargs="+")
    args = parser.parse_args()
    if args.command in ("install", "pause", "uninstall", "schedule-status"):
        return schedule(args.command)
    if args.command == "login":
        with workflow_lock(ROOT):
            code = subprocess.call([node_binary(), str(ROOT / "browser.mjs"), "login"])
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
        if (Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist").exists():
            schedule("install")
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
