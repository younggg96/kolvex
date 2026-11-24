"""Scanner logics: the built-in default, editable numbers, versioned storage and routes."""

import uuid
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.api.routes.trade_os import scanner as route
from app.services.trade_os.scanner import evaluate_symbol
from app.services.trade_os.scanner_logics import LogicNotFound, ScannerLogicService
from app.services.trade_os.scanner_params import (
    InvalidScannerParams,
    default_params,
    detection_params,
    validate_params,
)
from app.services.trade_os.setup_detection import DEFAULT_PARAMS
from tests.test_trade_os_scanner import SPY, TODAY, clear, signal_bars

USER, OTHER = "user-1", "user-2"


# --------------------------------------------------------------------------- params


def test_default_logic_is_exactly_swing_v3_1():
    assert detection_params(default_params()) == DEFAULT_PARAMS
    assert validate_params({}) == default_params()


@pytest.mark.parametrize(
    "raw, field",
    [
        ({"surprise": 1}, "surprise"),
        ({"min_price": "10"}, "min_price"),
        ({"min_price": True}, "min_price"),
        ({"pivot_lookback": 20.5}, "pivot_lookback"),
        ({"target_r_multiple": 50}, "target_r_multiple"),
        ({"pullback_min_days": 8, "pullback_max_days": 5}, "pullback_min_days"),
        ({"min_stop_distance": 0.2, "max_stop_distance": 0.1}, "min_stop_distance"),
    ],
)
def test_bad_values_are_rejected_not_clamped(raw, field):
    with pytest.raises(InvalidScannerParams) as error:
        validate_params(raw)
    assert error.value.field == field


def test_custom_numbers_change_the_scan():
    default = evaluate_symbol("NVDA", signal_bars(), SPY, "risk_on", clear, TODAY)
    assert default["status"] == "SIGNAL_CONFIRMED"

    two_r = evaluate_symbol(
        "NVDA",
        signal_bars(),
        SPY,
        "risk_on",
        clear,
        TODAY,
        logic=validate_params({"target_r_multiple": 2}),
    )
    assert two_r["status"] == "SIGNAL_CONFIRMED"
    assert two_r["reward_risk"] == "2.00"
    assert float(two_r["suggested_target"]) < float(default["suggested_target"])

    pricey = evaluate_symbol(
        "NVDA",
        signal_bars(),
        SPY,
        "risk_on",
        clear,
        TODAY,
        logic=validate_params({"min_price": 500}),
    )
    assert pricey["status"] == "INELIGIBLE"
    assert pricey["status_reason"] == "LIQUIDITY_FILTER"

    strict_rs = evaluate_symbol(
        "NVDA",
        signal_bars(),
        SPY,
        "risk_on",
        clear,
        TODAY,
        logic=validate_params({"rs20_min": 0.5}),
    )
    assert strict_rs["status_reason"] == "RS20_NOT_POSITIVE"

    # Earnings on Fri 11/27 is inside the default 5-session blackout, outside a 1-session one.
    soon = lambda _s: {"next_date": date(2026, 11, 27)}  # noqa: E731
    assert (
        evaluate_symbol("NVDA", signal_bars(), SPY, "risk_on", soon, TODAY)["status_reason"]
        == "EARNINGS_BLACKOUT"
    )
    short = evaluate_symbol(
        "NVDA",
        signal_bars(),
        SPY,
        "risk_on",
        soon,
        TODAY,
        logic=validate_params({"earnings_blackout_sessions": 1}),
    )
    assert short["status"] == "SIGNAL_CONFIRMED"


# --------------------------------------------------------------------------- storage


class FakeTable:
    """Just enough of the Supabase query builder for strategy_versions."""

    def __init__(self, rows):
        self.rows = rows
        self.filters = []
        self.mode, self.payload = "select", None

    def select(self, *_):
        return self

    def eq(self, key, value):
        self.filters.append(lambda row: row.get(key) == value)
        return self

    def like(self, key, pattern):
        prefix = pattern.rstrip("%")
        self.filters.append(lambda row: str(row.get(key, "")).startswith(prefix))
        return self

    def insert(self, payload):
        self.mode, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.mode, self.payload = "update", payload
        return self

    def execute(self):
        class Result:
            pass

        result = Result()
        if self.mode == "insert":
            row = {
                **self.payload,
                "id": str(uuid.uuid4()),
                "created_at": f"2026-11-23T00:00:{len(self.rows):02d}Z",
            }
            self.rows.append(row)
            result.data = [row]
            return result
        matched = [row for row in self.rows if all(f(row) for f in self.filters)]
        if self.mode == "update":
            for row in matched:
                row.update(self.payload)
        result.data = [dict(row) for row in matched]
        return result


class FakeSupabase:
    def __init__(self):
        self.rows = []

    def table(self, _name):
        return FakeTable(self.rows)


def test_edit_adds_a_version_and_delete_retires_every_version():
    db = FakeSupabase()
    service = ScannerLogicService(db)
    created = service.create_logic(USER, "Tight stop", {"stop_atr_buffer": 0.25})
    assert created["key"].startswith("CUSTOM_") and created["version"] == "1"

    edited = service.update_logic(USER, created["key"], "Tight stop 2R", {"target_r_multiple": 2})
    assert edited["version"] == "2"
    assert edited["params"]["target_r_multiple"] == 2
    assert edited["params"]["stop_atr_buffer"] == 0.75  # an edit saves the full set it was given
    assert len(db.rows) == 2 and db.rows[0]["parameters"]["stop_atr_buffer"] == 0.25

    listed = service.list_logics(USER)
    assert [item["key"] for item in listed] == ["default", created["key"]]
    assert listed[1]["version"] == "2"
    assert service.list_logics(OTHER) == [listed[0]]  # never another user's logics

    service.delete_logic(USER, created["key"])
    assert all(row["status"] == "retired" for row in db.rows)
    assert [item["key"] for item in service.list_logics(USER)] == ["default"]
    with pytest.raises(LogicNotFound):
        service.get_logic(USER, created["key"])


def test_builtin_default_cannot_be_edited_or_deleted():
    service = ScannerLogicService(FakeSupabase())
    with pytest.raises(LogicNotFound):
        service.update_logic(USER, "default", "Mine", {})
    with pytest.raises(LogicNotFound):
        service.delete_logic(USER, "default")
    with pytest.raises(LogicNotFound):
        service.get_logic(USER, "SWING_V3_TREND_PULLBACK")  # seeded versions aren't logics


# --------------------------------------------------------------------------- routes


@pytest.fixture
def client(monkeypatch):
    db = FakeSupabase()
    app = FastAPI()
    app.include_router(route.router)
    app.dependency_overrides[get_current_user_id] = lambda: USER
    app.dependency_overrides[route.get_logic_service] = lambda: ScannerLogicService(db)
    runs = []

    async def fake_run(**kwargs):
        runs.append(kwargs)
        return {"candidates": [], "logic": kwargs.get("logic")}

    monkeypatch.setattr(route, "run_opportunity_scanner", fake_run)
    return TestClient(app), runs


def test_routes_create_edit_run_delete(client):
    http, runs = client
    assert http.get("/scanner/logics/spec").json()["target_r_multiple"]["default"] == 3.0

    made = http.post("/scanner/logics", json={"name": "2R", "params": {"target_r_multiple": 2}})
    assert made.status_code == 201
    key = made.json()["key"]

    bad = http.put(f"/scanner/logics/{key}", json={"name": "2R", "params": {"pivot_lookback": 1}})
    assert bad.status_code == 422 and bad.json()["detail"]["field"] == "pivot_lookback"

    edited = http.put(
        f"/scanner/logics/{key}", json={"name": "2.5R", "params": {"target_r_multiple": 2.5}}
    )
    assert edited.json()["version"] == "2"

    http.post("/scanner/run", json={"logic": key, "save_to_db": False})
    assert runs[-1]["logic"]["params"]["target_r_multiple"] == 2.5
    assert runs[-1]["user_id"] == USER

    http.post("/scanner/run", json={})
    assert runs[-1]["logic"] is None and runs[-1]["user_id"] is None  # default stays shared

    assert http.post("/scanner/run", json={"logic": "CUSTOM_NOPE"}).status_code == 404
    assert http.delete("/scanner/logics/default").status_code == 404
    assert http.delete(f"/scanner/logics/{key}").status_code == 200
    assert [item["key"] for item in http.get("/scanner/logics").json()] == ["default"]
