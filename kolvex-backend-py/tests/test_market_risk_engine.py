from datetime import date, datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.api.routes import market_risk as routes
from app.services.market_risk import engine, repository, service
from app.services.market_risk.calendar import trading_days

DAYS = trading_days(date(2021, 1, 4), date(2024, 12, 31))
CALM = {"vix": 15.0, "vvix": 90.0, "vix9d": 14.0, "vix3m": 17.0}
STRESS = {"vix": 40.0, "vvix": 140.0, "vix9d": 46.0, "vix3m": 33.0}


def _series(values_by_day) -> engine.Series:
    series: engine.Series = {}
    for day, values in values_by_day.items():
        values = dict(values)
        values["vix9d_vix_ratio"] = values["vix9d"] / values["vix"]
        values["vix_vix3m_ratio"] = values["vix"] / values["vix3m"]
        for key, value in values.items():
            series.setdefault(key, {})[day] = (value, "valid")
    return series


def _path(stress_days: set[int], n: int = 600) -> engine.Series:
    """Flat calm values (every percentile 50, score 50) with stress on the given sessions."""
    return _series({DAYS[i]: (STRESS if i in stress_days else CALM) for i in range(n)})


def test_needs_min_history_before_scoring():
    evaluation = engine.evaluate(_path(set(), n=engine.MIN_HISTORY + 5))
    first = next(d for d in evaluation.days if d.score is not None)
    assert evaluation.days.index(first) == engine.MIN_HISTORY
    assert evaluation.days[0].confidence == "insufficient_history"
    assert first.confidence == "complete" and first.coverage == 1.0


def test_missing_key_metric_gives_no_score_and_keeps_stage():
    series = _path(set(), n=400)
    del series["vvix"][DAYS[399]]
    evaluation = engine.evaluate(series)
    last = evaluation.days[-1]
    assert last.score is None and last.confidence == "insufficient_coverage"
    assert last.stage == evaluation.days[-2].stage  # last confirmed stage is kept
    assert evaluation.latest.trading_date == DAYS[398]


def test_no_look_ahead():
    """A day's result does not change when later sessions are appended."""
    full = engine.evaluate(_path({450, 451, 452}, n=500))
    cut = engine.evaluate(_path({450, 451, 452}, n=455))
    for a, b in zip(cut.days, full.days):
        assert (a.score, a.stage, a.components) == (b.score, b.stage, b.components)


def test_deterministic():
    a, b = engine.evaluate(_path({400, 401})), engine.evaluate(_path({400, 401}))
    assert [d.score for d in a.days] == [d.score for d in b.days]
    assert a.days[-1].inputs_hash == b.days[-1].inputs_hash


def test_score_is_weighted_percentile():
    evaluation = engine.evaluate(_path({500}, n=501))
    day = evaluation.days[-1]
    # Every input is far above its history: each percentile is 100.
    assert [c["percentile"] for c in day.components] == [100.0] * 4
    assert day.score == 100.0 and day.level == "extreme"
    assert sum(c["weight"] for c in day.components) == 1.0


def test_acceleration_needs_two_confirmed_sessions_and_conditions():
    evaluation = engine.evaluate(_path({400, 401, 402}))
    by_day = {d.trading_date: d for d in evaluation.days}
    assert by_day[DAYS[399]].stage == engine.STABLE
    assert by_day[DAYS[400]].stage == engine.STABLE  # pending, not yet confirmed
    assert by_day[DAYS[400]].pending_stage == engine.ACCELERATION
    assert by_day[DAYS[401]].stage == engine.ACCELERATION
    event = next(e for e in evaluation.events if e.new == engine.ACCELERATION)
    assert event.effective_date == DAYS[401] and event.previous == engine.STABLE
    assert "vix_above_28" in event.rules and "vvix_above_110" in event.rules


def test_one_day_spike_does_not_change_stage():
    evaluation = engine.evaluate(_path({400}))
    assert all(e.new != engine.ACCELERATION for e in evaluation.events[1:])


def test_recovery_goes_through_normalization_then_stable():
    evaluation = engine.evaluate(_path(set(range(400, 410))))
    stages = [e.new for e in evaluation.events[1:]]
    assert stages[:3] == [engine.ACCELERATION, engine.NORMALIZATION, engine.STABLE]
    normalized = next(e for e in evaluation.events if e.new == engine.NORMALIZATION)
    stable = next(e for e in evaluation.events[1:] if e.new == engine.STABLE)
    # Back to stable only after five confirming sessions.
    assert DAYS.index(stable.effective_date) - DAYS.index(normalized.effective_date) >= 5


def test_candidate_stage_rules():
    c = engine.candidate_stage
    assert c(engine.STABLE, 59, 0, 3, 59) == engine.STABLE
    assert c(engine.STABLE, 60, 0, 3, 60) == engine.BUILD_UP
    assert c(engine.BUILD_UP, 56, 0, 0, 58) == engine.BUILD_UP  # hysteresis
    assert c(engine.BUILD_UP, 54, 0, 0, 58) == engine.STABLE
    assert c(engine.STABLE, 80, 1, 2, 80) == engine.BUILD_UP  # high but unconfirmed
    assert c(engine.STABLE, 80, 2, 0, 80) == engine.ACCELERATION
    assert c(engine.ACCELERATION, 72, 2, 0, 90) == engine.ACCELERATION
    assert c(engine.ACCELERATION, 72, 0, 3, 90) == engine.NORMALIZATION
    assert c(engine.NORMALIZATION, 80, 0, 3, 90) == engine.BUILD_UP
    assert c(engine.NORMALIZATION, 50, 0, 2, 90) == engine.STABLE


def test_checklist_statuses():
    evaluation = engine.evaluate(_path({398, 399}, n=400))
    items = {i["rule_key"]: i for i in engine.checklist(evaluation)}
    assert items["RISK-001"]["status"] == "triggered"
    assert items["RISK-001"]["first_triggered_on"] == DAYS[398]
    assert items["RISK-004"]["status"] == "disabled"  # put/call not in v1.0
    assert items["RECOVERY-001"]["status"] == "not_triggered"
    pending = engine.checklist(engine.evaluate(_path({399}, n=400)))
    assert {i["rule_key"]: i["status"] for i in pending}["RISK-002"] == "pending_confirmation"


def test_metric_status_bands():
    assert engine.metric_status("vix", 19.9) == "normal"
    assert engine.metric_status("vix", 28) == "elevated"
    assert engine.metric_status("vix", 35) == "critical"
    assert engine.metric_status("vix_vix3m_ratio", 0.97) == "watch"
    assert engine.metric_status("vix9d", 20) is None


def test_plan_snapshot_is_insert_only():
    day = engine.evaluate(_path(set(), n=300)).latest
    row = repository.plan_snapshot(day, [], "fresh")
    assert row["snapshot_revision"] == 1 and row["model_version"] == engine.MODEL_VERSION
    same = [{"snapshot_revision": 1, "inputs_hash": day.inputs_hash}]
    assert repository.plan_snapshot(day, same, "fresh") is None
    changed = [{"snapshot_revision": 1, "inputs_hash": "old"}]
    assert repository.plan_snapshot(day, changed, "fresh")["snapshot_revision"] == 2


def test_freshness():
    friday = date(2026, 11, 20)
    monday_evening = datetime(2026, 11, 24, 0, 0, tzinfo=timezone.utc)  # 19:00 ET Mon
    assert service.freshness(date(2026, 11, 23), monday_evening) == "fresh"
    assert service.freshness(friday, monday_evening) == "delayed"
    assert service.freshness(friday - timedelta(days=1), monday_evening) == "stale"


def _client(monkeypatch, loaded=None, error=False, user="u1"):
    async def fake_loaded():
        if error:
            raise service.MarketRiskUnavailable("table missing")
        return loaded

    monkeypatch.setattr(service, "get_loaded", fake_loaded)
    app = FastAPI()
    app.include_router(routes.router)

    def identity():
        if user is None:
            raise HTTPException(401)
        return user

    app.dependency_overrides[get_current_user_id] = identity
    return TestClient(app)


def _loaded(series):
    return service.Loaded(series, engine.evaluate(series), "database", datetime.now(timezone.utc))


def test_api_latest_and_history(monkeypatch):
    client = _client(monkeypatch, _loaded(_path({398, 399}, n=400)))
    body = client.get("/market-risk/latest").json()
    assert body["model_version"] == "v1.0" and body["as_of"] == DAYS[399].isoformat()
    assert body["stage"]["current"] == engine.ACCELERATION
    assert [m["metric_key"] for m in body["metrics"]][:2] == ["vix", "vvix"]
    assert body["metrics"][0]["previous_value"] is not None
    history = client.get("/market-risk/history?range=1M").json()
    assert len(history["points"]) == 21 and history["points"][-1]["date"] == DAYS[399].isoformat()
    assert client.get("/market-risk/history?range=2W").status_code == 422


def test_api_failures_are_not_hidden(monkeypatch):
    assert _client(monkeypatch, error=True).get("/market-risk/latest").status_code == 503
    short = _client(monkeypatch, _loaded(_path(set(), n=100)))
    response = short.get("/market-risk/latest")
    assert response.status_code == 503 and response.json()["detail"]["code"] == "no_score"
    assert _client(monkeypatch, user=None).get("/market-risk/latest").status_code == 401
