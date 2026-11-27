import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import workflow  # noqa: E402
from test_digest import LABELS, TOPICS, client_for, raw_run  # noqa: E402

TODAY = "2026-11-20"


@pytest.mark.parametrize(
    ("state", "hour", "force", "expected"),
    [
        ({}, 10, False, "before_run_hour"),
        ({}, 10, True, None),
        ({}, 19, False, None),
        ({"date_pt": "2026-11-19", "status": "complete", "attempts": 1}, 20, False, None),
        ({"date_pt": TODAY, "status": "complete", "attempts": 1}, 20, False, "done_today"),
        ({"date_pt": TODAY, "status": "manual_exists", "attempts": 1}, 20, False, "done_today"),
        ({"date_pt": TODAY, "status": "blocked", "attempts": 1}, 20, False, "stopped_today"),
        ({"date_pt": TODAY, "status": "login_required", "attempts": 1}, 20, False, "stopped_today"),
        ({"date_pt": TODAY, "status": "failed", "attempts": 1}, 20, False, None),
        ({"date_pt": TODAY, "status": "failed", "attempts": 2}, 20, False, "attempts_exhausted"),
    ],
)
def test_daily_gate(state, hour, force, expected):
    assert workflow.should_run(state, TODAY, hour, force) == expected


def database(imported_by):
    db = MagicMock()
    rows = [] if imported_by is False else [{"imported_by": imported_by}]
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = rows
    return db


def collector_writing(raw):
    def collect(root, directory):
        (directory / "raw.json").write_text(json.dumps(raw, ensure_ascii=False))
        return 0 if raw["status"] == "complete" else 1

    return collect


@pytest.fixture
def run(tmp_path, monkeypatch):
    monkeypatch.setattr(workflow, "load_env", lambda: None)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "key")

    def fake_digest(raw, api_key, client=None):
        return original(raw, api_key, client_for(LABELS, TOPICS))

    original = workflow.digest.make_digest
    monkeypatch.setattr(workflow.digest, "make_digest", fake_digest)
    # Validation compares date_pt against today's Pacific date; the fixture day is in the past.
    return lambda **kwargs: workflow.run_once(root=tmp_path, force=True, **kwargs)


def test_complete_run_upserts_without_an_admin_id(run, tmp_path):
    db = database(False)
    result = run(db=db, collector=collector_writing(raw_run()))
    assert result["status"] == "complete", result
    records = db.table.return_value.upsert.call_args.args[0]
    assert records[0]["date_pt"] == "2026-11-20"
    assert records[0]["imported_by"] is None
    state = json.loads((tmp_path / "state" / "day.json").read_text())
    assert state["status"] == "complete" and state["attempts"] == 1


def test_manual_import_wins_and_nothing_is_collected(run):
    db = database("admin-id")
    collector = MagicMock()
    result = run(db=db, collector=collector)
    assert result["status"] == "manual_exists"
    collector.assert_not_called()
    db.table.return_value.upsert.assert_not_called()


def test_dry_run_validates_but_never_touches_the_database(run, tmp_path):
    result = run(dry_run=True, collector=collector_writing(raw_run()))
    assert result["status"] == "dry_run", result
    assert (Path(result["directory"]) / "digest.json").exists()
    assert not (tmp_path / "state" / "day.json").exists()


def test_login_wall_stops_without_calling_the_model(run, monkeypatch):
    monkeypatch.setattr(workflow.digest, "make_digest", MagicMock(side_effect=AssertionError))
    db = database(False)
    blocked = {**raw_run(), "status": "login_required", "reason": "login_wall", "posts": []}
    result = run(db=db, collector=collector_writing(blocked))
    assert result["status"] == "login_required"
    db.table.return_value.upsert.assert_not_called()
